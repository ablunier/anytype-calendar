import { describe, expect, test } from 'vitest'
import { AnytypeClient, type AnytypeFetch } from '@anytype-calendar/anytype-client/infrastructure'
import { AnytypeV1SchemaGateway } from './anytype-v1-schema-gateway'

type FetchCall = { url: string; init: Parameters<AnytypeFetch>[1] }
type Reply = { status: number; body: unknown }

const API_KEY = 'ak_secret'
const BASE = 'http://127.0.0.1:31009'
const SPACE_ID = 'bafy.space'

function setup(...replies: Reply[]) {
  const calls: FetchCall[] = []
  const client = new AnytypeClient({
    fetch: async (url, init) => {
      calls.push({ url, init })
      const reply = replies[Math.min(calls.length, replies.length) - 1]
      if (!reply) throw new Error('no reply scripted')
      return { status: reply.status, text: async () => JSON.stringify(reply.body) }
    }
  })
  return { gateway: new AnytypeV1SchemaGateway(client), calls }
}

const page = (data: unknown[], hasMore = false): Reply => ({
  status: 200,
  body: { data, pagination: { total: data.length, offset: 0, limit: 1000, has_more: hasMore } }
})

const unauthorized: Reply = {
  status: 401,
  body: { object: 'error', status: 401, code: 'unauthorized', message: 'invalid api key' }
}

const space = (id: string, name: string, object = 'anytype.space') => ({ object, id, name })

describe('listSpaces', () => {
  test('asks for the spaces with the key and resolves their ids and names', async () => {
    const { gateway, calls } = setup(page([space('sp_1', 'Personal')]))

    await expect(gateway.listSpaces(API_KEY)).resolves.toEqual({
      ok: true,
      value: { spaces: [{ id: 'sp_1', name: 'Personal' }], hasNotGrantedSpaces: false }
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(`${BASE}/v1/spaces?offset=0&limit=1000`)
    expect(calls[0]?.init.method).toBe('GET')
    expect(calls[0]?.init.headers).toMatchObject({ Authorization: `Bearer ${API_KEY}` })
  })

  test('follows the pages until Anytype has no more', async () => {
    const { gateway, calls } = setup(
      page([space('sp_1', 'One'), space('sp_2', 'Two')], true),
      page([space('sp_3', 'Three')])
    )

    const result = await gateway.listSpaces(API_KEY)

    expect(result.ok && result.value.spaces.map(({ id }) => id)).toEqual(['sp_1', 'sp_2', 'sp_3'])
    expect(calls[1]?.url).toBe(`${BASE}/v1/spaces?offset=2&limit=1000`)
  })

  test('stops at an empty page even if it claims more', async () => {
    const { gateway, calls } = setup(page([space('sp_1', 'One')], true), page([], true))
    await gateway.listSpaces(API_KEY)
    expect(calls).toHaveLength(2)
  })

  test('keeps spaces and chat spaces, leaving out direct chats and the tech space', async () => {
    const { gateway } = setup(
      page([
        space('sp_1', 'Personal'),
        space('sp_2', 'Team chat', 'anytype.chatspace'),
        space('sp_3', 'Mara', 'anytype.onetoone'),
        space('sp_4', '', 'anytype.techspace')
      ])
    )
    const result = await gateway.listSpaces(API_KEY)
    expect(result.ok && result.value.spaces.map(({ id }) => id)).toEqual(['sp_1', 'sp_2'])
  })

  test('resolves a refused key as unauthorized', async () => {
    const { gateway } = setup(unauthorized)
    await expect(gateway.listSpaces(API_KEY)).resolves.toEqual({ ok: false, failure: 'unauthorized' })
  })

  test('rejects on any other error status', async () => {
    const { gateway } = setup({ status: 500, body: { object: 'error', code: 'internal_server_error' } })
    await expect(gateway.listSpaces(API_KEY)).rejects.toThrow('500')
  })

  test('rejects when the body is not a page', async () => {
    const { gateway } = setup({ status: 200, body: { spaces: [] } })
    await expect(gateway.listSpaces(API_KEY)).rejects.toThrow('spaces')
  })

  test('rejects when a space has no id', async () => {
    const { gateway } = setup(page([{ object: 'anytype.space', name: 'Personal' }]))
    await expect(gateway.listSpaces(API_KEY)).rejects.toThrow('spaces')
  })
})

const property = (key: string, name: string, format = 'date') => ({
  object: 'property',
  id: `p_${key}`,
  key,
  name,
  format
})

const type = (key: string, name: string, extra: Record<string, unknown> = {}) => ({
  object: 'type',
  id: `t_${key}`,
  key,
  name,
  archived: false,
  icon: { format: 'icon', name: 'checkbox', color: 'lime' },
  properties: [property('due_date', 'Due date')],
  ...extra
})

describe('listTypes', () => {
  test("asks for the space's types and resolves their icons and properties", async () => {
    const { gateway, calls } = setup(page([type('task', 'Task')]))

    await expect(gateway.listTypes(API_KEY, SPACE_ID)).resolves.toEqual({
      ok: true,
      value: [
        {
          key: 'task',
          name: 'Task',
          icon: { name: 'checkbox', color: 'lime' },
          properties: [{ key: 'due_date', name: 'Due date', format: 'date' }]
        }
      ]
    })
    expect(calls[0]?.url).toBe(`${BASE}/v1/spaces/${SPACE_ID}/types?offset=0&limit=1000`)
  })

  test('follows the pages until Anytype has no more', async () => {
    const { gateway } = setup(page([type('task', 'Task')], true), page([type('book', 'Book')]))
    const result = await gateway.listTypes(API_KEY, SPACE_ID)
    expect(result.ok && result.value.map(({ key }) => key)).toEqual(['task', 'book'])
  })

  test('leaves out archived types', async () => {
    const { gateway } = setup(page([type('task', 'Task'), type('old', 'Old', { archived: true })]))
    const result = await gateway.listTypes(API_KEY, SPACE_ID)
    expect(result.ok && result.value.map(({ key }) => key)).toEqual(['task'])
  })

  test('carries no icon for a type drawn with an emoji', async () => {
    const { gateway } = setup(page([type('idea', 'Idea', { icon: { format: 'emoji', emoji: '💡' } })]))
    const result = await gateway.listTypes(API_KEY, SPACE_ID)
    expect(result.ok && result.value[0]?.icon).toBeNull()
  })

  test('resolves a refused key as unauthorized', async () => {
    const { gateway } = setup(unauthorized)
    await expect(gateway.listTypes(API_KEY, SPACE_ID)).resolves.toEqual({
      ok: false,
      failure: 'unauthorized'
    })
  })

  test('rejects when a type has no properties', async () => {
    const { gateway } = setup(page([type('task', 'Task', { properties: undefined })]))
    await expect(gateway.listTypes(API_KEY, SPACE_ID)).rejects.toThrow('types')
  })

  test('rejects when a property has no format', async () => {
    const { gateway } = setup(
      page([type('task', 'Task', { properties: [{ key: 'due_date', name: 'Due date' }] })])
    )
    await expect(gateway.listTypes(API_KEY, SPACE_ID)).rejects.toThrow('types')
  })
})
