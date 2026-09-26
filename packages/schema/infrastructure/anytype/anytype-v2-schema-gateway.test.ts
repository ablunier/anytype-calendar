import { describe, expect, test } from 'vitest'
import {
  AnytypeClient,
  AnytypeDialectProbe,
  type AnytypeFetch
} from '@anytype-calendar/anytype-client/infrastructure'
import { AnytypeV2SchemaGateway } from './anytype-v2-schema-gateway'

type FetchCall = { url: string; init: Parameters<AnytypeFetch>[1] }
type Reply = { status: number; body: unknown }
type FileReply = { status: number; contentType: string | null; bytes: number[] }

const API_KEY = 'ak_secret'
const BASE = 'http://127.0.0.1:31009'
const SPACE_ID = 'bafy.space'

/**
 * Replies by path (without the query string); a list of replies is served in turn. Downloads
 * are served from `files`, and bytes encode as their comma-joined values.
 */
function setup(routes: Record<string, Reply | Reply[]>, files: Record<string, FileReply> = {}) {
  const calls: FetchCall[] = []
  const downloads: string[] = []
  const served: Record<string, number> = {}
  const client = new AnytypeClient({
    fetch: async (url, init) => {
      calls.push({ url, init })
      const path = url.slice(BASE.length).split('?')[0] ?? ''
      const route = routes[path]
      if (!route) return { status: 404, text: async () => '404 page not found' }
      const replies = Array.isArray(route) ? route : [route]
      const n = (served[path] = (served[path] ?? 0) + 1)
      const reply = replies[Math.min(n, replies.length) - 1] as Reply
      return { status: reply.status, text: async () => JSON.stringify(reply.body) }
    },
    fetchBytes: async (url) => {
      downloads.push(url)
      const file = files[url.slice(BASE.length)] ?? { status: 404, contentType: null, bytes: [] }
      return { ...file, bytes: async () => new Uint8Array(file.bytes) }
    }
  })
  const probe = new AnytypeDialectProbe({ client })
  const encodeBase64 = (bytes: Uint8Array): string => [...bytes].join(',')
  return {
    gateway: new AnytypeV2SchemaGateway({ client, probe, encodeBase64 }),
    probe,
    calls,
    downloads
  }
}

const page = (data: unknown[], hasMore = false): Reply => ({
  status: 200,
  body: { data, total: data.length, offset: 0, limit: 1000, has_more: hasMore }
})

const notGranted: Reply = {
  status: 403,
  body: { status: 403, code: 'space_not_granted', message: 'x', issues: [] }
}

const unauthorized: Reply = {
  status: 401,
  body: { object: 'error', status: 401, code: 'unauthorized', message: 'invalid api key' }
}

describe('listSpaces', () => {
  test('asks for the spaces by their full ids and resolves their ids and names', async () => {
    const { gateway, calls } = setup({
      '/v2/spaces': page([{ id: 'bafy.personal', name: 'Personal' }])
    })

    await expect(gateway.listSpaces(API_KEY)).resolves.toEqual({
      ok: true,
      value: { spaces: [{ id: 'bafy.personal', name: 'Personal' }], hasNotGrantedSpaces: false }
    })
    expect(calls[0]?.url).toBe(`${BASE}/v2/spaces?ids=full&offset=0&limit=1000`)
    expect(calls[0]?.init.headers).toMatchObject({ Authorization: `Bearer ${API_KEY}` })
  })

  const ICON = '/v2/spaces/bafy.personal/files/bafy.icon/content?width=64'
  const withIcon = page([{ id: 'bafy.personal', name: 'Personal', icon_image: 'bafy.icon' }])

  test("carries a space's image as a data URL", async () => {
    const { gateway } = setup(
      { '/v2/spaces': withIcon },
      { [ICON]: { status: 200, contentType: 'image/png; charset=binary', bytes: [1, 2] } }
    )

    const result = await gateway.listSpaces(API_KEY)

    expect(result.ok && result.value.spaces).toEqual([
      { id: 'bafy.personal', name: 'Personal', icon: 'data:image/png;base64,1,2' }
    ])
  })

  test('downloads an image once, however often the spaces are listed', async () => {
    const { gateway, downloads } = setup(
      { '/v2/spaces': withIcon },
      { [ICON]: { status: 200, contentType: 'image/png', bytes: [1] } }
    )

    await gateway.listSpaces(API_KEY)
    await gateway.listSpaces(API_KEY)

    expect(downloads).toEqual([`${BASE}${ICON}`])
  })

  test.each([
    ['cannot be downloaded', { status: 404, contentType: null, bytes: [] }],
    ['is not an image', { status: 200, contentType: 'text/html', bytes: [1] }]
  ])('leaves out an image that %s', async (_, file) => {
    const { gateway } = setup({ '/v2/spaces': withIcon }, { [ICON]: file })

    const result = await gateway.listSpaces(API_KEY)

    expect(result.ok && result.value.spaces).toEqual([{ id: 'bafy.personal', name: 'Personal' }])
  })

  test('follows the pages until Anytype has no more', async () => {
    const { gateway, calls } = setup({
      '/v2/spaces': [page([{ id: 'sp_1' }, { id: 'sp_2' }], true), page([{ id: 'sp_3' }])]
    })

    const result = await gateway.listSpaces(API_KEY)

    expect(result.ok && result.value.spaces.map(({ id }) => id)).toEqual(['sp_1', 'sp_2', 'sp_3'])
    expect(calls[1]?.url).toBe(`${BASE}/v2/spaces?ids=full&offset=2&limit=1000`)
  })

  test('says when the key was not granted every space of the account', async () => {
    const { gateway } = setup({
      '/v2/spaces': {
        status: 200,
        body: { ...page([{ id: 'sp_1' }]).body as object, has_not_granted_spaces: true }
      }
    })
    const result = await gateway.listSpaces(API_KEY)
    expect(result.ok && result.value.hasNotGrantedSpaces).toBe(true)
  })

  test('resolves a refused key as unauthorized', async () => {
    const { gateway } = setup({ '/v2/spaces': unauthorized })
    await expect(gateway.listSpaces(API_KEY)).resolves.toEqual({ ok: false, failure: 'unauthorized' })
  })

  test('rejects when the body is not a v2 page', async () => {
    const { gateway } = setup({
      '/v2/spaces': { status: 200, body: { data: [], pagination: { has_more: false } } }
    })
    await expect(gateway.listSpaces(API_KEY)).rejects.toThrow('spaces')
  })
})

/** Shaped like a real `GET /v2/spaces/{id}/types/{key}` answer, trimmed. */
const typeDocument = (name: string, definitions: unknown[], icon: unknown = null) => ({
  formatVersion: '2.0',
  kind: 'object_type',
  properties: { name, created_date: '2026-09-17T09:42:59Z' },
  blocks: [{ id: 'dataview', type: 'dataview' }],
  ...(icon === null ? {} : { icon }),
  type_settings: { layout: 'basic', property_definitions: definitions }
})

const definition = (property: string, name: string, format = 'date') => ({
  property,
  internal_key: `ik_${property}`,
  name,
  format
})

const TYPES = `/v2/spaces/${SPACE_ID}/types`

describe('listTypes', () => {
  test('reads each listed type for its icon and properties', async () => {
    const { gateway, calls } = setup({
      [TYPES]: page([{ key: 'appointment', name: 'Appointment' }]),
      [`${TYPES}/appointment`]: {
        status: 200,
        body: typeDocument(
          'Appointment',
          [definition('data', 'Date'), definition('location', 'Location', 'text')],
          { format: 'icon', name: 'calendar-number', color: 'pink' }
        )
      }
    })

    await expect(gateway.listTypes(API_KEY, SPACE_ID)).resolves.toEqual({
      ok: true,
      value: [
        {
          key: 'appointment',
          name: 'Appointment',
          icon: { name: 'calendar-number', color: 'pink' },
          properties: [
            { key: 'data', name: 'Date', format: 'date' },
            { key: 'location', name: 'Location', format: 'text' }
          ]
        }
      ]
    })
    expect(calls.map(({ url }) => url)).toEqual([
      `${BASE}${TYPES}?offset=0&limit=1000`,
      `${BASE}${TYPES}/appointment`
    ])
  })

  test("spells Anytype's own keys the way the rest of the API does", async () => {
    const { gateway } = setup({
      [TYPES]: page([{ key: 'page' }]),
      [`${TYPES}/page`]: {
        status: 200,
        body: typeDocument('Page', [definition('lastOpenedDate', 'Last opened date')])
      }
    })

    const result = await gateway.listTypes(API_KEY, SPACE_ID)

    expect(result.ok && result.value[0]?.properties[0]?.key).toBe('last_opened_date')
  })

  test('keeps the listed order however the reads complete', async () => {
    const keys = ['a', 'b', 'c', 'd', 'e', 'f']
    const { gateway } = setup({
      [TYPES]: page(keys.map((key) => ({ key }))),
      ...Object.fromEntries(
        keys.map((key) => [`${TYPES}/${key}`, { status: 200, body: typeDocument(key.toUpperCase(), []) }])
      )
    })

    const result = await gateway.listTypes(API_KEY, SPACE_ID)

    expect(result.ok && result.value.map(({ name }) => name)).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
  })

  test("carries v1's key for a type v2 serves by its internal key", async () => {
    const book = { ...typeDocument('Book', []), type_settings: { api_key: 'book', property_definitions: [] } }
    const { gateway, calls } = setup({
      [TYPES]: page([{ key: '6a67272659c08021576f3127' }]),
      [`${TYPES}/6a67272659c08021576f3127`]: { status: 200, body: book }
    })

    const result = await gateway.listTypes(API_KEY, SPACE_ID)

    expect(result.ok && result.value[0]).toMatchObject({ key: '6a67272659c08021576f3127', formerKey: 'book' })
    expect(calls.some(({ url }) => url.includes('/v1/'))).toBe(false)
  })

  test("asks v1 for the key of a date property v2 serves by its internal key, matched by name", async () => {
    const document = {
      ...typeDocument('Book', []),
      type_settings: {
        api_key: 'book',
        property_definitions: [
          { property: 'start_date', internal_key: '6a6733dc', name: 'Start date', format: 'date' },
          { property: '6a67263559c0', internal_key: '6a67263559c0', name: 'Finished', format: 'date' },
          { property: '6a65038f59c0', internal_key: '6a65038f59c0', name: 'Status', format: 'select' }
        ]
      }
    }
    const v1Types = {
      data: [
        {
          key: 'book',
          properties: [
            { key: 'start_date', name: 'Start date', format: 'date' },
            { key: 'finished', name: 'Finished', format: 'date' },
            { key: 'status', name: 'Status', format: 'select' }
          ]
        }
      ],
      pagination: { has_more: false }
    }
    const { gateway, calls } = setup({
      [TYPES]: page([{ key: '6a67272659c0' }]),
      [`${TYPES}/6a67272659c0`]: { status: 200, body: document },
      [`/v1/spaces/${SPACE_ID}/types`]: { status: 200, body: v1Types }
    })

    const result = await gateway.listTypes(API_KEY, SPACE_ID)

    expect(result.ok && result.value[0]?.properties).toEqual([
      { key: 'start_date', name: 'Start date', format: 'date' },
      { key: '6a67263559c0', formerKey: 'finished', name: 'Finished', format: 'date' },
      { key: '6a65038f59c0', name: 'Status', format: 'select' }
    ])
    expect(calls.filter(({ url }) => url.includes('/v1/'))).toHaveLength(1)
  })

  test('knows no former property key when v1 does not answer', async () => {
    const document = {
      ...typeDocument('Book', []),
      type_settings: {
        property_definitions: [{ property: '6a67', internal_key: '6a67', name: 'Finished', format: 'date' }]
      }
    }
    const { gateway } = setup({
      [TYPES]: page([{ key: 'book' }]),
      [`${TYPES}/book`]: { status: 200, body: document }
    })

    const result = await gateway.listTypes(API_KEY, SPACE_ID)

    expect(result.ok && result.value[0]?.properties).toEqual([{ key: '6a67', name: 'Finished', format: 'date' }])
  })

  test('carries no icon for a type drawn with an emoji', async () => {
    const { gateway } = setup({
      [TYPES]: page([{ key: 'idea' }]),
      [`${TYPES}/idea`]: { status: 200, body: typeDocument('Idea', [], { format: 'emoji', emoji: '💡' }) }
    })
    const result = await gateway.listTypes(API_KEY, SPACE_ID)
    expect(result.ok && result.value[0]?.icon).toBeNull()
  })

  test('leaves out a type deleted between the list and its read', async () => {
    const { gateway } = setup({
      [TYPES]: page([{ key: 'gone' }, { key: 'task' }]),
      [`${TYPES}/gone`]: { status: 404, body: { status: 404, code: 'not_found', message: 'x', issues: [] } },
      [`${TYPES}/task`]: { status: 200, body: typeDocument('Task', []) }
    })
    const result = await gateway.listTypes(API_KEY, SPACE_ID)
    expect(result.ok && result.value.map(({ key }) => key)).toEqual(['task'])
  })

  test('leaves out a type whose space was taken out of the grant after the list', async () => {
    const { gateway } = setup({
      [TYPES]: page([{ key: 'task' }]),
      [`${TYPES}/task`]: notGranted
    })
    await expect(gateway.listTypes(API_KEY, SPACE_ID)).resolves.toEqual({ ok: true, value: [] })
  })

  test('reads a space the key is no longer granted as holding no types', async () => {
    const { gateway } = setup({ [TYPES]: notGranted })
    await expect(gateway.listTypes(API_KEY, SPACE_ID)).resolves.toEqual({ ok: true, value: [] })
  })

  test('resolves a refused key as unauthorized', async () => {
    const { gateway } = setup({ [TYPES]: unauthorized })
    await expect(gateway.listTypes(API_KEY, SPACE_ID)).resolves.toEqual({
      ok: false,
      failure: 'unauthorized'
    })
  })

  test('resolves a key refused mid-read as unauthorized', async () => {
    const { gateway } = setup({ [TYPES]: page([{ key: 'task' }]), [`${TYPES}/task`]: unauthorized })
    await expect(gateway.listTypes(API_KEY, SPACE_ID)).resolves.toEqual({
      ok: false,
      failure: 'unauthorized'
    })
  })

  test('rejects when a type document has no property definitions', async () => {
    const { gateway } = setup({
      [TYPES]: page([{ key: 'task' }]),
      [`${TYPES}/task`]: { status: 200, body: { kind: 'object_type' } }
    })
    await expect(gateway.listTypes(API_KEY, SPACE_ID)).rejects.toThrow('types')
  })

  test('rejects when a type row has no key', async () => {
    const { gateway } = setup({ [TYPES]: page([{ name: 'Task' }]) })
    await expect(gateway.listTypes(API_KEY, SPACE_ID)).rejects.toThrow('types')
  })

  test('rejects, and forgets the dialect, when Anytype no longer has the v2 route', async () => {
    const { gateway, probe, calls } = setup({ '/v2/auth/whoami': { status: 200, body: {} } })
    await probe.probe(API_KEY)

    await expect(gateway.listTypes(API_KEY, SPACE_ID)).rejects.toThrow('404')
    await probe.probe(API_KEY)

    expect(calls.filter(({ url }) => url.includes('/whoami'))).toHaveLength(2)
  })
})

describe('listSelectOptions', () => {
  const OPTIONS = `/v2/spaces/${SPACE_ID}/properties/6aaa4502/options`

  test("resolves a property's options, following the pages", async () => {
    const { gateway, calls } = setup({
      [OPTIONS]: [
        page([{ name: 'P1', color: 'red' }], true),
        page([{ name: 'P2', color: 'orange' }, { name: 'No colour' }])
      ]
    })

    await expect(gateway.listSelectOptions(API_KEY, SPACE_ID, '6aaa4502')).resolves.toEqual({
      ok: true,
      value: [
        { name: 'P1', color: 'red' },
        { name: 'P2', color: 'orange' }
      ]
    })
    expect(calls[1]?.url).toBe(`${BASE}${OPTIONS}?offset=1&limit=1000`)
  })

  test.each([
    ['a property since deleted', { status: 404, body: { status: 404, code: 'not_found', message: 'x' } }],
    ['a key the space does not have', { status: 400, body: { status: 400, code: 'bad_request', message: 'x' } }],
    ['a space no longer granted', notGranted]
  ])('reads %s as having no options', async (_, reply) => {
    const { gateway } = setup({ [OPTIONS]: reply })
    await expect(gateway.listSelectOptions(API_KEY, SPACE_ID, '6aaa4502')).resolves.toEqual({
      ok: true,
      value: []
    })
  })

  test('resolves a refused key as unauthorized', async () => {
    const { gateway } = setup({ [OPTIONS]: unauthorized })
    await expect(gateway.listSelectOptions(API_KEY, SPACE_ID, '6aaa4502')).resolves.toEqual({
      ok: false,
      failure: 'unauthorized'
    })
  })

  test('rejects, and forgets the dialect, when Anytype no longer has the v2 route', async () => {
    const { gateway, probe, calls } = setup({ '/v2/auth/whoami': { status: 200, body: {} } })
    await probe.probe(API_KEY)

    await expect(gateway.listSelectOptions(API_KEY, SPACE_ID, '6aaa4502')).rejects.toThrow('404')
    await probe.probe(API_KEY)

    expect(calls.filter(({ url }) => url.includes('/whoami'))).toHaveLength(2)
  })
})
