import { describe, expect, test } from 'vitest'
import { AnytypeClient, type AnytypeFetch } from '@anytype-calendar/anytype-client/infrastructure'
import { AnytypeSchemaGateway } from './anytype-schema-gateway'

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
  return { gateway: new AnytypeSchemaGateway(client), calls }
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
      value: [{ id: 'sp_1', name: 'Personal' }]
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

    expect(result.ok && result.value.map(({ id }) => id)).toEqual(['sp_1', 'sp_2', 'sp_3'])
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
    expect(result.ok && result.value.map(({ id }) => id)).toEqual(['sp_1', 'sp_2'])
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

describe('listProperties', () => {
  test("asks for the space's properties and resolves their keys and formats", async () => {
    const { gateway, calls } = setup(
      page([{ object: 'property', id: 'p1', key: 'due_date', name: 'Due date', format: 'date' }])
    )

    await expect(gateway.listProperties(API_KEY, SPACE_ID)).resolves.toEqual({
      ok: true,
      value: [{ key: 'due_date', name: 'Due date', format: 'date' }]
    })
    expect(calls[0]?.url).toBe(`${BASE}/v1/spaces/${SPACE_ID}/properties?offset=0&limit=1000`)
  })

  test('resolves a refused key as unauthorized', async () => {
    const { gateway } = setup(unauthorized)
    await expect(gateway.listProperties(API_KEY, SPACE_ID)).resolves.toEqual({
      ok: false,
      failure: 'unauthorized'
    })
  })

  test('rejects when a property has no format', async () => {
    const { gateway } = setup(page([{ key: 'due_date', name: 'Due date' }]))
    await expect(gateway.listProperties(API_KEY, SPACE_ID)).rejects.toThrow('properties')
  })
})

describe('countObjectsWithAnyValue', () => {
  test('searches for objects with any of the properties set and reads only the total', async () => {
    const { gateway, calls } = setup({
      status: 200,
      body: { data: [{}], pagination: { total: 37, offset: 0, limit: 1, has_more: true } }
    })

    await expect(
      gateway.countObjectsWithAnyValue(API_KEY, SPACE_ID, ['due_date', 'start_date'])
    ).resolves.toEqual({ ok: true, value: 37 })
    expect(calls[0]?.url).toBe(`${BASE}/v1/spaces/${SPACE_ID}/search?offset=0&limit=1`)
    expect(calls[0]?.init.method).toBe('POST')
    expect(JSON.parse(calls[0]?.init.body ?? '')).toEqual({
      filters: {
        operator: 'or',
        conditions: [
          { property_key: 'due_date', condition: 'nempty' },
          { property_key: 'start_date', condition: 'nempty' }
        ]
      }
    })
  })

  test('resolves a refused key as unauthorized', async () => {
    const { gateway } = setup(unauthorized)
    await expect(gateway.countObjectsWithAnyValue(API_KEY, SPACE_ID, ['due_date'])).resolves.toEqual({
      ok: false,
      failure: 'unauthorized'
    })
  })

  test('rejects when the body carries no total', async () => {
    const { gateway } = setup({ status: 200, body: { data: [] } })
    await expect(gateway.countObjectsWithAnyValue(API_KEY, SPACE_ID, ['due_date'])).rejects.toThrow(
      'search'
    )
  })

  test('rejects when Anytype cannot be reached', async () => {
    const gateway = new AnytypeSchemaGateway(
      new AnytypeClient({
        fetch: async () => {
          throw new TypeError('fetch failed')
        }
      })
    )
    await expect(gateway.countObjectsWithAnyValue(API_KEY, SPACE_ID, ['due_date'])).rejects.toThrow(
      'fetch failed'
    )
  })
})
