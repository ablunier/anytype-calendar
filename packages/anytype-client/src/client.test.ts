import { describe, expect, test, vi } from 'vitest'
import { AnytypeClient, AnytypeTransportError, isUnmatchedRoute, type AnytypeFetch } from './client'

type FetchCall = { url: string; init: Parameters<AnytypeFetch>[1] }
type Reply =
  | { status: number; text?: string; contentType?: string; bytes?: Uint8Array }
  | Error

const API_KEY = 'ak_secret'
const BASE = 'http://127.0.0.1:31009'

function setup(replies: Reply[] = [{ status: 200, text: '{}' }], options: { onUnsupported?: () => void } = {}) {
  const calls: FetchCall[] = []
  const fetch: AnytypeFetch = async (url, init) => {
    calls.push({ url, init })
    const reply = replies[Math.min(calls.length, replies.length) - 1]
    if (!reply) throw new Error('no reply scripted')
    if (reply instanceof Error) throw reply
    return {
      status: reply.status,
      headers: { get: (name) => (name === 'Content-Type' ? (reply.contentType ?? null) : null) },
      text: async () => reply.text ?? '',
      arrayBuffer: async () => (reply.bytes ?? new Uint8Array()).slice().buffer
    }
  }
  let ids = 0
  const client = new AnytypeClient({ fetch, randomId: () => `idem-${++ids}`, ...options })
  return { client, api: client.withApiKey(API_KEY), calls }
}

const bodyOf = (call: FetchCall | undefined): unknown => JSON.parse(call?.init.body ?? 'null')

describe('request', () => {
  test('sends no body or key unless given', async () => {
    const { client, calls } = setup()

    await client.request({ method: 'GET', path: '/v2/spaces' })

    expect(calls).toEqual([{ url: `${BASE}/v2/spaces`, init: { method: 'GET', headers: {} } }])
  })

  test('sends a body as JSON, a key as a bearer token, and extra headers beside them', async () => {
    const { client, calls } = setup()

    await client.request({
      method: 'POST',
      path: '/v2/x',
      body: { name: 'Work' },
      apiKey: API_KEY,
      headers: { 'Anytype-Version': '2025-11-08' }
    })

    expect(calls[0]?.init).toEqual({
      method: 'POST',
      headers: {
        'Anytype-Version': '2025-11-08',
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: '{"name":"Work"}'
    })
  })

  test('sends the query in order, arrays comma-separated, leaving out what is undefined', async () => {
    const { client, calls } = setup()

    await client.request({
      method: 'GET',
      path: '/v2/x',
      query: { view: 'v 1', skipped: undefined, fields: ['a b', 'c'], limit: 5, full: true }
    })

    expect(calls[0]?.url).toBe(`${BASE}/v2/x?view=v%201&fields=a%20b,c&limit=5&full=true`)
  })

  test('honours a configured base URL', async () => {
    const calls: string[] = []
    const client = new AnytypeClient({
      baseUrl: 'http://127.0.0.1:31012',
      fetch: async (url) => {
        calls.push(url)
        return { status: 200, headers: { get: () => null }, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) }
      }
    })

    await client.request({ method: 'GET', path: '/v2/spaces' })

    expect(calls).toEqual(['http://127.0.0.1:31012/v2/spaces'])
  })

  test('uses the global fetch when given none', async () => {
    const fetch = vi.fn(async () => ({
      status: 200,
      headers: { get: () => null },
      text: async () => '{"ok":1}',
      arrayBuffer: async () => new ArrayBuffer(0)
    }))
    vi.stubGlobal('fetch', fetch)
    try {
      await expect(new AnytypeClient().request({ method: 'GET', path: '/v2/spaces' })).resolves.toMatchObject({
        ok: true,
        body: { ok: 1 }
      })
      expect(fetch).toHaveBeenCalledWith(`${BASE}/v2/spaces`, { method: 'GET', headers: {} })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  test('resolves a 2xx with its parsed body, and an empty one as null', async () => {
    const { client } = setup([{ status: 201, text: '{"challenge_id":"ch_1"}' }, { status: 204 }])

    await expect(client.request({ method: 'POST', path: '/v2/x' })).resolves.toEqual({
      ok: true,
      status: 201,
      body: { challenge_id: 'ch_1' }
    })
    await expect(client.request({ method: 'DELETE', path: '/v2/x' })).resolves.toEqual({
      ok: true,
      status: 204,
      body: null
    })
  })

  test("resolves v1's error shape with its code and message", async () => {
    const { client } = setup([
      {
        status: 500,
        text: '{"object":"error","status":500,"code":"internal_server_error","message":"failed to authenticate user"}'
      }
    ])

    await expect(client.request({ method: 'POST', path: '/v2/auth/api_keys' })).resolves.toEqual({
      ok: false,
      status: 500,
      error: { code: 'internal_server_error', message: 'failed to authenticate user', issues: [] },
      unsupported: false
    })
  })

  test('resolves a v2 error with the issues it names, leaving out any that say nothing', async () => {
    const { client } = setup([
      {
        status: 400,
        text: JSON.stringify({
          status: 400,
          code: 'invalid_input',
          message: 'invalid ops',
          issues: [
            { path: 'ops[0].set.due_date', message: 'not a date', hint: 'use RFC 3339' },
            { path: 'ops[0]' },
            { message: 'the batch was refused' }
          ]
        })
      }
    ])

    await expect(client.request({ method: 'PATCH', path: '/v2/x' })).resolves.toEqual({
      ok: false,
      status: 400,
      error: {
        code: 'invalid_input',
        message: 'invalid ops',
        issues: [
          { path: 'ops[0].set.due_date', message: 'not a date' },
          { path: '', message: 'the batch was refused' }
        ]
      },
      unsupported: false
    })
  })

  test('resolves an error body that is not an error with empty fields', async () => {
    const { client } = setup([{ status: 404, text: '["not", "an", "error"]' }])

    await expect(client.request({ method: 'GET', path: '/v2/x' })).resolves.toMatchObject({
      ok: false,
      error: { code: '', message: '', issues: [] }
    })
  })

  test('tells an unmatched route from a handler 404, and says so', async () => {
    const onUnsupported = vi.fn()
    const { client } = setup(
      [
        { status: 404, text: '404 page not found' },
        { status: 404, text: '{"status":404,"code":"not_found","message":"x","issues":[]}' }
      ],
      { onUnsupported }
    )

    const unmatched = await client.request({ method: 'GET', path: '/v2/auth/whoami' })
    const notFound = await client.request({ method: 'GET', path: '/v2/spaces/x' })

    expect(unmatched).toMatchObject({ ok: false, status: 404, unsupported: true })
    expect(isUnmatchedRoute(unmatched)).toBe(true)
    expect(notFound).toMatchObject({ ok: false, status: 404, unsupported: false })
    expect(isUnmatchedRoute(notFound)).toBe(false)
    expect(onUnsupported).toHaveBeenCalledTimes(1)
  })

  test('rejects when the connection fails, saying why', async () => {
    const { client } = setup([new TypeError('fetch failed')])

    const request = client.request({ method: 'GET', path: '/v2/spaces' })

    await expect(request).rejects.toThrow(AnytypeTransportError)
    await expect(request).rejects.toThrow('fetch failed')
  })

  test('rejects when a success is something other than JSON', async () => {
    const { client } = setup([{ status: 200, text: '<html>not anytype</html>' }])

    await expect(client.request({ method: 'GET', path: '/v2/spaces' })).rejects.toThrow(AnytypeTransportError)
  })

  test('sends an idempotent request once more with the same key when it got no answer', async () => {
    const { client, calls } = setup([new Error('socket hang up'), { status: 200, text: '{}' }])

    await expect(client.request({ method: 'PATCH', path: '/v2/x', idempotent: true })).resolves.toMatchObject({ ok: true })

    expect(calls).toHaveLength(2)
    expect(calls[0]?.init.headers['Idempotency-Key']).toBe('idem-1')
    expect(calls[1]?.init.headers['Idempotency-Key']).toBe('idem-1')
  })

  test('rejects an idempotent request unanswered twice, and never retries an answer', async () => {
    const { client, calls } = setup([new Error('socket hang up')])

    await expect(client.request({ method: 'PATCH', path: '/v2/x', idempotent: true })).rejects.toThrow('socket hang up')
    expect(calls).toHaveLength(2)

    const answered = setup([{ status: 500, text: '{}' }])
    await answered.client.request({ method: 'PATCH', path: '/v2/x', idempotent: true })
    expect(answered.calls).toHaveLength(1)
  })

  test('never retries a request that is not idempotent', async () => {
    const { client, calls } = setup([new Error('socket hang up'), { status: 200, text: '{}' }])

    await expect(client.request({ method: 'POST', path: '/v2/x' })).rejects.toThrow('socket hang up')
    expect(calls).toHaveLength(1)
  })
})

describe('download', () => {
  test('reads a file as bytes, with its media type', async () => {
    const { api, calls } = setup([{ status: 200, contentType: 'image/png', bytes: new Uint8Array([1, 2]) }])

    await expect(api.files.content('sp/1', 'f1', { width: 64 })).resolves.toEqual({
      ok: true,
      status: 200,
      body: { contentType: 'image/png', bytes: new Uint8Array([1, 2]) }
    })
    expect(calls).toEqual([
      {
        url: `${BASE}/v2/spaces/sp%2F1/files/f1/content?width=64`,
        init: { method: 'GET', headers: { Authorization: `Bearer ${API_KEY}` } }
      }
    ])
  })

  test('resolves an error status with its error', async () => {
    const { api } = setup([{ status: 404, text: '{"status":404,"code":"not_found","message":"no file","issues":[]}' }])

    await expect(api.files.content('sp', 'f1')).resolves.toMatchObject({
      ok: false,
      status: 404,
      error: { code: 'not_found' }
    })
  })
})

describe('routes', () => {
  test('pairs without a key', async () => {
    const { client, calls } = setup()

    await client.auth.createChallenge({ appName: 'Calendar' })
    await client.auth.createApiKey({ challengeId: 'ch_1', code: '2749' })

    expect(calls.map(({ url, init }) => [init.method, url, bodyOf({ url, init }), init.headers['Authorization']])).toEqual([
      ['POST', `${BASE}/v2/auth/challenges`, { app_name: 'Calendar' }, undefined],
      ['POST', `${BASE}/v2/auth/api_keys`, { challenge_id: 'ch_1', code: '2749' }, undefined]
    ])
  })

  test.each([
    ['whoami', (api) => api.auth.whoami(), 'GET', '/v2/auth/whoami?ids=full'],
    ['whoami with spaces', (api) => api.auth.whoami({ spaces: true }), 'GET', '/v2/auth/whoami?ids=full&spaces=true'],
    ['spaces', (api) => api.spaces.list({ offset: 0, limit: 10 }), 'GET', '/v2/spaces?ids=full&offset=0&limit=10'],
    ['types', (api) => api.types.list('sp'), 'GET', '/v2/spaces/sp/types'],
    ['a type', (api) => api.types.get('sp', 'my type'), 'GET', '/v2/spaces/sp/types/my%20type'],
    ['options', (api) => api.properties.listOptions('sp', 'status', { offset: 5 }), 'GET', '/v2/spaces/sp/properties/status/options?offset=5'],
    ['views', (api) => api.queries.listViews('sp', 'q1'), 'GET', '/v2/spaces/sp/queries/q1/views'],
    [
      "a query's objects",
      (api) => api.queries.listObjects('sp', 'q1', { view: 'v1', fields: ['due_date', 'done'] }, { offset: 0, limit: 1000 }),
      'GET',
      '/v2/spaces/sp/queries/q1/objects?view=v1&fields=due_date,done&offset=0&limit=1000'
    ],
    ['an object', (api) => api.objects.get('sp', 'obj', { include: 'properties' }), 'GET', '/v2/spaces/sp/objects/obj?include=properties']
  ] satisfies [string, (api: ReturnType<AnytypeClient['withApiKey']>) => Promise<unknown>, string, string][])(
    'reads %s',
    async (_, call, method, path) => {
      const { api, calls } = setup()

      await call(api)

      expect(calls).toEqual([{ url: `${BASE}${path}`, init: { method, headers: { Authorization: `Bearer ${API_KEY}` } } }])
    }
  )

  test('searches a space with the request as the body', async () => {
    const { api, calls } = setup()
    const search = {
      type: 'task',
      filters: [{ property: 'due_date', condition: 'not_empty' as const }],
      fields: ['due_date']
    }

    await api.search.inSpace('sp', search, { offset: 0, limit: 1000 })

    expect(calls[0]?.url).toBe(`${BASE}/v2/spaces/sp/search?offset=0&limit=1000`)
    expect(calls[0]?.init.method).toBe('POST')
    expect(bodyOf(calls[0])).toEqual(search)
  })

  test('creates and edits objects idempotently', async () => {
    const { api, calls } = setup()

    await api.objects.create('sp', { type: 'task', name: 'Call', properties: { due_date: '2026-09-16T14:00:00Z' } })
    await api.objects.update('sp', 'obj', [{ op: 'set_properties', set: { done: true } }])

    expect(calls.map(({ url, init }) => [init.method, url, init.headers['Idempotency-Key']])).toEqual([
      ['POST', `${BASE}/v2/spaces/sp/objects`, 'idem-1'],
      ['PATCH', `${BASE}/v2/spaces/sp/objects/obj`, 'idem-2']
    ])
    expect(bodyOf(calls[0])).toEqual({ type: 'task', name: 'Call', properties: { due_date: '2026-09-16T14:00:00Z' } })
    expect(bodyOf(calls[1])).toEqual({ ops: [{ op: 'set_properties', set: { done: true } }] })
  })
})
