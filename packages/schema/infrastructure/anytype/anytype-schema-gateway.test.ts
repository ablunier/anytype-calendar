import { describe, expect, test } from 'vitest'
import { AnytypeClient, type AnytypeFetch } from '@ablunier/anytype-client'
import { AnytypeSchemaGateway } from './anytype-schema-gateway'

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
      if (url.includes('/files/')) {
        downloads.push(url)
        const file = files[url.slice(BASE.length)] ?? { status: 404, contentType: null, bytes: [] }
        return {
          status: file.status,
          headers: { get: (name) => (name === 'Content-Type' ? file.contentType : null) },
          text: async () => '',
          arrayBuffer: async () => new Uint8Array(file.bytes).buffer
        }
      }
      calls.push({ url, init })
      const path = url.slice(BASE.length).split('?')[0] ?? ''
      const route = routes[path]
      if (!route) return { status: 404, text: async () => '404 page not found' }
      const replies = Array.isArray(route) ? route : [route]
      const n = (served[path] = (served[path] ?? 0) + 1)
      const reply = replies[Math.min(n, replies.length) - 1] as Reply
      return { status: reply.status, text: async () => JSON.stringify(reply.body) }
    }
  })
  const encodeBase64 = (bytes: Uint8Array): string => [...bytes].join(',')
  return {
    gateway: new AnytypeSchemaGateway({ client, encodeBase64 }),
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

  test('resolves an Anytype without the v2 route as outdated', async () => {
    const { gateway } = setup({})
    await expect(gateway.listSpaces(API_KEY)).resolves.toEqual({ ok: false, failure: 'outdated' })
  })

  test('rejects when the body is not a page', async () => {
    const { gateway } = setup({ '/v2/spaces': { status: 200, body: { spaces: [] } } })
    await expect(gateway.listSpaces(API_KEY)).rejects.toThrow('page')
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
const TEMPLATES = `/v2/spaces/${SPACE_ID}/templates`
const OBJECTS = `/v2/spaces/${SPACE_ID}/objects`

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
      `${BASE}${TYPES}/appointment`,
      `${BASE}${TEMPLATES}?offset=0&limit=1000`
    ])
  })

  describe('templates', () => {
    const pageType = {
      [TYPES]: page([{ key: 'page', name: 'Page' }]),
      [`${TYPES}/page`]: { status: 200, body: typeDocument('Page', [definition('tag', 'Tag', 'multi_select')]) }
    }
    const template = (blocks: unknown[]): Reply => ({ status: 200, body: { kind: 'template', template_for: 'page', blocks } })
    const PROPERTIES = `/v2/spaces/${SPACE_ID}/properties`
    const spaceProperties = page([
      { key: 'due_date', name: 'Due date', format: 'date' },
      { key: 'tag', name: 'Tag', format: 'multi_select' }
    ])
    const propertiesOf = async (gateway: ReturnType<typeof setup>['gateway']) => {
      const result = await gateway.listTypes(API_KEY, SPACE_ID)
      return result.ok ? result.value.map(({ properties }) => properties.map(({ key }) => key)) : result
    }

    test('adds the properties a template shows in its content without the type listing them', async () => {
      const { gateway, calls } = setup({
        ...pageType,
        [TEMPLATES]: page([{ id: 'tpl_1', name: 'Trip', template_for: 'page' }]),
        [`${OBJECTS}/tpl_1`]: template([
          { id: 'a', type: 'heading_2', text: 'When' },
          { id: 'b', type: 'property', property: 'due_date' },
          { id: 'c', type: 'property', property: 'tag' }
        ]),
        [PROPERTIES]: spaceProperties
      })

      const result = await gateway.listTypes(API_KEY, SPACE_ID)

      expect(result.ok && result.value[0]?.properties).toEqual([
        { key: 'tag', name: 'Tag', format: 'multi_select' },
        { key: 'due_date', name: 'Due date', format: 'date' }
      ])
      expect(calls.map(({ url }) => url)).toContain(`${BASE}${OBJECTS}/tpl_1?include=blocks`)
    })

    test('adds a property once, however many templates show it', async () => {
      const { gateway } = setup({
        ...pageType,
        [TEMPLATES]: page([
          { id: 'tpl_1', template_for: 'page' },
          { id: 'tpl_2', template_for: 'page' }
        ]),
        [`${OBJECTS}/tpl_1`]: template([{ type: 'property', property: 'due_date' }]),
        [`${OBJECTS}/tpl_2`]: template([{ type: 'property', property: 'due_date' }]),
        [PROPERTIES]: spaceProperties
      })

      await expect(propertiesOf(gateway)).resolves.toEqual([['tag', 'due_date']])
    })

    test('does not read the space for properties when no template adds one', async () => {
      const { gateway, calls } = setup({
        ...pageType,
        [TEMPLATES]: page([{ id: 'tpl_1', template_for: 'page' }]),
        [`${OBJECTS}/tpl_1`]: template([{ type: 'property', property: 'tag' }])
      })

      await expect(propertiesOf(gateway)).resolves.toEqual([['tag']])
      expect(calls.map(({ url }) => url)).not.toContain(`${BASE}${PROPERTIES}?offset=0&limit=1000`)
    })

    test("leaves alone a template of a type that was not read, and a block naming a property the space lacks", async () => {
      const { gateway, calls } = setup({
        ...pageType,
        [TEMPLATES]: page([
          { id: 'tpl_1', template_for: 'page' },
          { id: 'tpl_2', template_for: 'note' }
        ]),
        [`${OBJECTS}/tpl_1`]: template([{ type: 'property', property: 'status' }]),
        [PROPERTIES]: spaceProperties
      })

      await expect(propertiesOf(gateway)).resolves.toEqual([['tag']])
      expect(calls.map(({ url }) => url)).not.toContain(`${BASE}${OBJECTS}/tpl_2?include=blocks`)
    })

    test('skips a template deleted between the list and its read', async () => {
      const { gateway } = setup({
        ...pageType,
        [TEMPLATES]: page([{ id: 'tpl_1', template_for: 'page' }]),
        [`${OBJECTS}/tpl_1`]: { status: 404, body: { status: 404, code: 'not_found', message: 'x', issues: [] } }
      })

      await expect(propertiesOf(gateway)).resolves.toEqual([['tag']])
    })

    test('reads a build that serves no templates as having none', async () => {
      const { gateway } = setup(pageType)

      await expect(propertiesOf(gateway)).resolves.toEqual([['tag']])
    })

    test('resolves a key refused while reading a template as unauthorized', async () => {
      const { gateway } = setup({
        ...pageType,
        [TEMPLATES]: page([{ id: 'tpl_1', template_for: 'page' }]),
        [`${OBJECTS}/tpl_1`]: unauthorized
      })

      await expect(gateway.listTypes(API_KEY, SPACE_ID)).resolves.toEqual({ ok: false, failure: 'unauthorized' })
    })
  })

  test('marks a property in the hidden section, which Anytype itself does not show', async () => {
    const { gateway } = setup({
      [TYPES]: page([{ key: 'page' }]),
      [`${TYPES}/page`]: {
        status: 200,
        body: typeDocument('Page', [
          { ...definition('creator', 'Created by', 'objects'), section: 'hidden' },
          { ...definition('tag', 'Tag', 'multi_select'), section: 'featured' },
          definition('due_date', 'Due date')
        ])
      }
    })

    const result = await gateway.listTypes(API_KEY, SPACE_ID)

    expect(result.ok && result.value[0]?.properties).toEqual([
      { key: 'creator', name: 'Created by', format: 'objects', hidden: true },
      { key: 'tag', name: 'Tag', format: 'multi_select' },
      { key: 'due_date', name: 'Due date', format: 'date' }
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

  test('carries no former key for a date property v2 serves by its internal key', async () => {
    const document = {
      ...typeDocument('Book', []),
      type_settings: {
        api_key: 'book',
        property_definitions: [{ property: '6a67', internal_key: '6a67', name: 'Finished', format: 'date' }]
      }
    }
    const { gateway, calls } = setup({
      [TYPES]: page([{ key: '6a6727' }]),
      [`${TYPES}/6a6727`]: { status: 200, body: document }
    })

    const result = await gateway.listTypes(API_KEY, SPACE_ID)

    expect(result.ok && result.value[0]?.properties).toEqual([{ key: '6a67', name: 'Finished', format: 'date' }])
    expect(calls.some(({ url }) => url.includes('/v1/'))).toBe(false)
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

  test('resolves a type route that stops being served mid-read as outdated', async () => {
    const { gateway } = setup({ [TYPES]: page([{ key: 'task' }]) })
    await expect(gateway.listTypes(API_KEY, SPACE_ID)).resolves.toEqual({ ok: false, failure: 'outdated' })
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

  test('resolves an Anytype without the v2 route as outdated', async () => {
    const { gateway } = setup({})
    await expect(gateway.listTypes(API_KEY, SPACE_ID)).resolves.toEqual({ ok: false, failure: 'outdated' })
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

  test('resolves an Anytype without the v2 route as outdated', async () => {
    const { gateway } = setup({})
    await expect(gateway.listSelectOptions(API_KEY, SPACE_ID, '6aaa4502')).resolves.toEqual({ ok: false, failure: 'outdated' })
  })
})

describe('listQueries', () => {
  const QUERY_ID = 'bafyreig35xn3pgwklcxro6eez4qn5afhdxe7yrtpafmrewry6gbtanbt5y'
  const SEARCH = `/v2/spaces/${SPACE_ID}/search`
  const DOCUMENT = `/v2/spaces/${SPACE_ID}/objects/${QUERY_ID}`
  const VIEWS = `/v2/spaces/${SPACE_ID}/queries/${QUERY_ID}/views`

  // As a real account answered, September 2026.
  const row = { id: QUERY_ID, name: 'Calendar probe', type: 'query' }
  const document: Reply = {
    status: 200,
    body: {
      $schema: 'https://schemas.anytype.io/anyblock/2.0/object.schema.json',
      formatVersion: '2.0',
      id: QUERY_ID,
      type: 'query',
      properties: { name: 'Calendar probe', origin: 'api', resolved_layout: 'set' },
      query_source: { types: ['task'] }
    }
  }
  const views = page([
    { filters: [{ property: 'done', condition: 'equal', value: false }], id: '63194', name: 'Open' },
    { id: 'd0e5c', name: 'Cal', type: 'calendar' }
  ])

  test("searches the space for queries, and reads each one's type and views", async () => {
    const { gateway, calls } = setup({ [SEARCH]: page([row]), [DOCUMENT]: document, [VIEWS]: views })

    await expect(gateway.listQueries(API_KEY, SPACE_ID)).resolves.toEqual({
      ok: true,
      value: [
        {
          id: QUERY_ID,
          name: 'Calendar probe',
          typeKeys: ['task'],
          views: [
            { id: '63194', name: 'Open' },
            { id: 'd0e5c', name: 'Cal' }
          ]
        }
      ]
    })
    expect(calls[0]?.url).toBe(`${BASE}${SEARCH}?offset=0&limit=1000`)
    expect(calls[0]?.init.method).toBe('POST')
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ type: 'query' })
    expect(calls.map(({ url }) => url)).toContain(`${BASE}${DOCUMENT}?include=properties`)
  })

  test('reads a query over no type as naming none', async () => {
    const { gateway } = setup({
      [SEARCH]: page([row]),
      [DOCUMENT]: { status: 200, body: { id: QUERY_ID, type: 'query', properties: {} } },
      [VIEWS]: views
    })
    const result = await gateway.listQueries(API_KEY, SPACE_ID)
    expect(result.ok && result.value[0]?.typeKeys).toEqual([])
  })

  test.each([
    ['its document', { [DOCUMENT]: { status: 404, body: { status: 404, code: 'not_found', message: 'x', issues: [] } }, [VIEWS]: views }],
    ['its views', { [DOCUMENT]: document, [VIEWS]: { status: 404, body: { status: 404, code: 'not_found', message: 'x', issues: [] } } }]
  ])('leaves out a query deleted before %s could be read', async (_, routes) => {
    const { gateway } = setup({ [SEARCH]: page([row]), ...routes })
    await expect(gateway.listQueries(API_KEY, SPACE_ID)).resolves.toEqual({ ok: true, value: [] })
  })

  test('reads a space the key is no longer granted as holding no queries', async () => {
    const { gateway } = setup({ [SEARCH]: notGranted })
    await expect(gateway.listQueries(API_KEY, SPACE_ID)).resolves.toEqual({ ok: true, value: [] })
  })

  test.each([
    ['the search', { [SEARCH]: unauthorized }],
    ['a document', { [SEARCH]: page([row]), [DOCUMENT]: unauthorized, [VIEWS]: views }],
    ['the views', { [SEARCH]: page([row]), [DOCUMENT]: document, [VIEWS]: unauthorized }]
  ])('resolves a key refused on %s as unauthorized', async (_, routes) => {
    const { gateway } = setup(routes)
    await expect(gateway.listQueries(API_KEY, SPACE_ID)).resolves.toEqual({
      ok: false,
      failure: 'unauthorized'
    })
  })

  test('resolves an Anytype without the v2 route as outdated', async () => {
    const { gateway } = setup({})
    await expect(gateway.listQueries(API_KEY, SPACE_ID)).resolves.toEqual({ ok: false, failure: 'outdated' })
  })
})

describe('listCollections', () => {
  const SEARCH = `/v2/spaces/${SPACE_ID}/search`
  const object = (id: string) => `/v2/spaces/${SPACE_ID}/objects/${id}`
  const document = (id: string, name: string): Reply => ({
    status: 200,
    body: { id, type: 'page', properties: { name } }
  })
  const notFound: Reply = { status: 404, body: { status: 404, code: 'not_found', message: 'x', issues: [] } }

  // As a real account answered, October 2026.
  const row = (id: string, name: string, backlinks: string[], modified = '2026-10-12T08:15:00Z') => ({
    id,
    name,
    type: 'collection',
    properties: { last_modified_date: modified, backlinks }
  })

  test('searches the space for collections with when each was last modified', async () => {
    const { gateway, calls } = setup({
      [SEARCH]: page([row('col_trip', 'Trip to Lisbon', ['obj_home']), row('col_q4', 'Q4 launch', [])])
    })

    await expect(gateway.listCollections(API_KEY, SPACE_ID)).resolves.toEqual({
      ok: true,
      value: [
        { id: 'col_trip', name: 'Trip to Lisbon', lastModified: Date.UTC(2026, 9, 12, 8, 15), backlinks: [] },
        { id: 'col_q4', name: 'Q4 launch', lastModified: Date.UTC(2026, 9, 12, 8, 15), backlinks: [] }
      ]
    })
    expect(calls[0]?.url).toBe(`${BASE}${SEARCH}?offset=0&limit=1000`)
    expect(calls[0]?.init.method).toBe('POST')
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      type: 'collection',
      fields: ['last_modified_date', 'backlinks']
    })
    // No name repeats, so no backlink is read.
    expect(calls).toHaveLength(1)
  })

  test('reads the names of the objects linking to collections whose name repeats, each once', async () => {
    const { gateway, calls } = setup({
      [SEARCH]: page([
        row('col_home', 'Notes', ['obj_home', 'obj_review']),
        row('col_work', 'Notes', ['obj_work', 'obj_review']),
        row('col_trip', 'Trip', ['obj_unread'])
      ]),
      [object('obj_home')]: document('obj_home', 'Home'),
      [object('obj_work')]: document('obj_work', 'Work'),
      [object('obj_review')]: document('obj_review', 'Weekly review')
    })

    const result = await gateway.listCollections(API_KEY, SPACE_ID)

    expect(result.ok && result.value.map(({ id, backlinks }) => ({ id, backlinks }))).toEqual([
      { id: 'col_home', backlinks: ['Home', 'Weekly review'] },
      { id: 'col_work', backlinks: ['Work', 'Weekly review'] },
      { id: 'col_trip', backlinks: [] }
    ])
    const reads = calls.map(({ url }) => url).filter((url) => url.includes('/objects/'))
    expect(reads.sort()).toEqual(
      ['obj_home', 'obj_review', 'obj_work'].map((id) => `${BASE}${object(id)}?include=properties`)
    )
  })

  test.each([
    ['gone', notFound],
    ['outside the grant', notGranted]
  ])('leaves out a backlink that is %s', async (_, reply) => {
    const { gateway } = setup({
      [SEARCH]: page([row('col_home', 'Notes', ['obj_home', 'obj_gone']), row('col_work', 'Notes', [])]),
      [object('obj_home')]: document('obj_home', 'Home'),
      [object('obj_gone')]: reply
    })
    const result = await gateway.listCollections(API_KEY, SPACE_ID)
    expect(result.ok && result.value[0]?.backlinks).toEqual(['Home'])
  })

  test('reads a collection with no last-modified date as having none', async () => {
    const { gateway } = setup({
      [SEARCH]: page([{ id: 'col_new', name: 'New', type: 'collection', properties: {} }])
    })
    await expect(gateway.listCollections(API_KEY, SPACE_ID)).resolves.toEqual({
      ok: true,
      value: [{ id: 'col_new', name: 'New', lastModified: null, backlinks: [] }]
    })
  })

  test.each([
    ['no longer granted', notGranted],
    ['not open', notFound]
  ])('reads a space %s as holding no collections', async (_, reply) => {
    const { gateway } = setup({ [SEARCH]: reply })
    await expect(gateway.listCollections(API_KEY, SPACE_ID)).resolves.toEqual({ ok: true, value: [] })
  })

  test.each([
    ['the search', { [SEARCH]: unauthorized }],
    [
      'a backlink',
      { [SEARCH]: page([row('a', 'Notes', ['obj_home']), row('b', 'Notes', [])]), [object('obj_home')]: unauthorized }
    ]
  ])('resolves a key refused on %s as unauthorized', async (_, routes) => {
    const { gateway } = setup(routes)
    await expect(gateway.listCollections(API_KEY, SPACE_ID)).resolves.toEqual({
      ok: false,
      failure: 'unauthorized'
    })
  })

  test('resolves an Anytype without the v2 route as outdated', async () => {
    const { gateway } = setup({})
    await expect(gateway.listCollections(API_KEY, SPACE_ID)).resolves.toEqual({ ok: false, failure: 'outdated' })
  })
})
