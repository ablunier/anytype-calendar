import { describe, expect, test } from 'vitest'
import { AnytypeClient, type AnytypeFetch } from '@ablunier/anytype-client'
import { AnytypeAuthGateway } from './anytype-auth-gateway'

type Reply = { status: number; text: string }
type FetchCall = { route: string; init: Parameters<AnytypeFetch>[1] }

const NO_ROUTE: Reply = { status: 404, text: '404 page not found' }
const json = (status: number, body: unknown): Reply => ({ status, text: JSON.stringify(body) })
const REFUSED = json(401, { object: 'error', status: 401, code: 'unauthorized', message: 'x' })
const AUTH_FAILURE = {
  object: 'error',
  status: 500,
  code: 'internal_server_error',
  message: 'failed to authenticate user'
}

/** A key the user paired for two spaces, read-only, as `whoami?ids=full&spaces=true` describes it. */
const RESTRICTED = json(200, {
  grant: {
    scoped: true,
    restricted: true,
    all_spaces: false,
    permission: 'read',
    spaces: [
      { id: 'bafy1.repl1', name: 'Work', permission: 'read' },
      { id: 'bafy2.repl2', name: 'Home', permission: 'read' }
    ]
  },
  key_status: 'scoped'
})
/** A key issued before grants: the real Anytype answers this for one. */
const LEGACY = json(200, {
  grant: { scoped: false, restricted: false, all_spaces: false, permission: null, spaces: [] },
  key_status: 'legacy'
})
const RESTRICTED_GRANT = {
  allSpaces: false,
  spaceIds: ['bafy1.repl1', 'bafy2.repl2'],
  permission: 'read'
}

/** Replies by method and path; a list of replies is served in turn. Any other route has none. */
function setup(routes: Record<string, Reply | Reply[]>) {
  const calls: FetchCall[] = []
  const served: Record<string, number> = {}
  const fetch: AnytypeFetch = async (url, init) => {
    const route = `${init.method} ${url.replace('http://127.0.0.1:31009', '').split('?')[0]}`
    calls.push({ route, init })
    const replies = routes[route]
    if (!replies) return { status: NO_ROUTE.status, text: async () => NO_ROUTE.text }
    const list = Array.isArray(replies) ? replies : [replies]
    const n = (served[route] = (served[route] ?? 0) + 1)
    const reply = list[Math.min(n, list.length) - 1] as Reply
    return { status: reply.status, text: async () => reply.text }
  }
  const gateway = new AnytypeAuthGateway(new AnytypeClient({ fetch }))
  return { gateway, calls, routes: () => calls.map(({ route }) => route) }
}

describe('createChallenge', () => {
  test('asks Anytype for a challenge under the app name and resolves its id', async () => {
    const { gateway, calls } = setup({ 'POST /v2/auth/challenges': json(201, { challenge_id: 'ch_1' }) })

    await expect(gateway.createChallenge('Calendar')).resolves.toEqual({ ok: true, challengeId: 'ch_1' })
    expect(calls[0]?.route).toBe('POST /v2/auth/challenges')
    expect(calls[0]?.init).toMatchObject({ method: 'POST', body: '{"app_name":"Calendar"}' })
    expect(calls[0]?.init.headers).not.toHaveProperty('Authorization')
  })

  test('reads an Anytype without the route as outdated', async () => {
    const { gateway } = setup({})
    await expect(gateway.createChallenge('Calendar')).resolves.toEqual({ ok: false, failure: 'outdated' })
  })

  test('reads an Anytype that asks a key of a route that needs none as outdated', async () => {
    const { gateway } = setup({ 'POST /v2/auth/challenges': REFUSED })
    await expect(gateway.createChallenge('Calendar')).resolves.toEqual({ ok: false, failure: 'outdated' })
  })

  test('rejects on an error status', async () => {
    const { gateway } = setup({
      'POST /v2/auth/challenges': json(500, { ...AUTH_FAILURE, message: 'failed to create a new challenge' })
    })
    await expect(gateway.createChallenge('Calendar')).rejects.toThrow('500')
  })
})

describe('exchangeCode', () => {
  test('exchanges the challenge and code for the key, and asks what the new key reaches', async () => {
    const { gateway, calls, routes } = setup({
      'POST /v2/auth/api_keys': json(201, { api_key: 'anytype_key', grant: null }),
      'GET /v2/auth/whoami': RESTRICTED
    })

    await expect(gateway.exchangeCode('ch_1', '2749')).resolves.toEqual({
      ok: true,
      apiKey: 'anytype_key',
      access: { grant: RESTRICTED_GRANT }
    })
    expect(calls[0]?.init.body).toBe('{"challenge_id":"ch_1","code":"2749"}')
    expect(routes()).toEqual(['POST /v2/auth/api_keys', 'GET /v2/auth/whoami'])
  })

  test('keeps the grant pairing answered with should whoami fail', async () => {
    const { gateway } = setup({
      'POST /v2/auth/api_keys': json(201, {
        api_key: 'anytype_key',
        grant: { all_spaces: false, space_ids: ['bafy1.repl1'], permission: 'readwrite' }
      }),
      'GET /v2/auth/whoami': json(500, { status: 500, code: 'internal', message: 'x' })
    })

    await expect(gateway.exchangeCode('ch_1', '2749')).resolves.toMatchObject({
      access: { grant: { allSpaces: false, spaceIds: ['bafy1.repl1'], permission: 'readwrite' } }
    })
  })

  test.each([400, 500])('resolves a %i as a rejected code', async (status) => {
    const { gateway } = setup({ 'POST /v2/auth/api_keys': json(status, { ...AUTH_FAILURE, status }) })
    await expect(gateway.exchangeCode('ch_1', '0000')).resolves.toEqual({ ok: false, failure: 'invalid-code' })
  })

  test('reads an Anytype without the route as outdated', async () => {
    const { gateway } = setup({})
    await expect(gateway.exchangeCode('ch_1', '2749')).resolves.toEqual({ ok: false, failure: 'outdated' })
  })

  test('rejects on any other error status, without echoing the body', async () => {
    const { gateway } = setup({ 'POST /v2/auth/api_keys': json(403, { message: 'anytype_secret' }) })
    const exchange = gateway.exchangeCode('ch_1', '2749')
    await expect(exchange).rejects.toThrow('403')
    await expect(exchange).rejects.not.toThrow('anytype_secret')
  })
})

describe('verifyApiKey', () => {
  test('accepts a key whoami answers for, and reads its grant from that answer', async () => {
    const { gateway, routes } = setup({ 'GET /v2/auth/whoami': RESTRICTED })

    await expect(gateway.verifyApiKey('ak')).resolves.toEqual({ ok: true, access: { grant: RESTRICTED_GRANT } })
    expect(routes()).toEqual(['GET /v2/auth/whoami'])
  })

  test('reads a legacy key as having no grant', async () => {
    const { gateway } = setup({ 'GET /v2/auth/whoami': LEGACY })
    await expect(gateway.verifyApiKey('ak')).resolves.toEqual({ ok: true, access: { grant: null } })
  })

  test('reads an all-spaces grant without its list of spaces', async () => {
    const { gateway } = setup({
      'GET /v2/auth/whoami': json(200, {
        grant: {
          scoped: true,
          restricted: false,
          all_spaces: true,
          permission: 'readwrite',
          space_count: 1,
          spaces: [{ id: 'bafy1.repl1', name: 'Work', permission: 'readwrite' }]
        }
      })
    })
    await expect(gateway.verifyApiKey('ak')).resolves.toEqual({
      ok: true,
      access: { grant: { allSpaces: true, spaceIds: [], permission: 'readwrite' } }
    })
  })

  test('asks afresh each time, since the grant may have changed in Anytype', async () => {
    const { gateway, routes } = setup({ 'GET /v2/auth/whoami': [LEGACY, RESTRICTED] })

    await expect(gateway.verifyApiKey('ak')).resolves.toMatchObject({ access: { grant: null } })
    await expect(gateway.verifyApiKey('ak')).resolves.toMatchObject({ access: { grant: RESTRICTED_GRANT } })
    expect(routes()).toEqual(['GET /v2/auth/whoami', 'GET /v2/auth/whoami'])
  })

  test('refuses a key whoami refuses', async () => {
    const { gateway } = setup({ 'GET /v2/auth/whoami': REFUSED })
    await expect(gateway.verifyApiKey('ak')).resolves.toEqual({ ok: false, failure: 'invalid-key' })
  })

  test('reads an Anytype without v2 as outdated, asking nothing of v1', async () => {
    const { gateway, routes } = setup({})

    await expect(gateway.verifyApiKey('ak')).resolves.toEqual({ ok: false, failure: 'outdated' })
    expect(routes()).toEqual(['GET /v2/auth/whoami'])
  })

  test('rejects on any other error status', async () => {
    const { gateway } = setup({ 'GET /v2/auth/whoami': json(500, { status: 500, code: 'internal', message: 'x' }) })
    await expect(gateway.verifyApiKey('ak')).rejects.toThrow('500')
  })
})
