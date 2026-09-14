import { describe, expect, test } from 'vitest'
import { AnytypeClient, type AnytypeFetch } from '@anytype-calendar/anytype-client/infrastructure'
import type { EventsSource } from '../../domain'
import { AnytypeEventsGateway } from './anytype-events-gateway'

type FetchCall = { url: string; init: Parameters<AnytypeFetch>[1] }
type Reply = { status: number; body: unknown }

const API_KEY = 'ak_secret'
const BASE = 'http://127.0.0.1:31009'
const SPACE_ID = 'bafy.space'

const TASKS: EventsSource = {
  spaceId: SPACE_ID,
  typeKey: 'task',
  from: 'due_date',
  to: null,
  includesTime: false
}
const PROJECTS: EventsSource = {
  spaceId: SPACE_ID,
  typeKey: 'project',
  from: 'start_date',
  to: 'due_date',
  includesTime: false
}

/** September 2026 two hours ahead of UTC. */
const WINDOW = { start: Date.parse('2026-08-31T22:00:00Z'), end: Date.parse('2026-09-30T21:59:59.999Z') }

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
  return { gateway: new AnytypeEventsGateway(client), calls }
}

const page = (data: unknown[], hasMore = false): Reply => ({
  status: 200,
  body: { data, pagination: { total: data.length, offset: 0, limit: 1000, has_more: hasMore } }
})

const date = (key: string, value: string) => ({
  object: 'property',
  id: `p_${key}`,
  key,
  name: key,
  format: 'date',
  date: value
})

const object = (id: string, name: string, properties: unknown[], extra: Record<string, unknown> = {}) => ({
  object: 'object',
  id,
  name,
  archived: false,
  space_id: SPACE_ID,
  type: { object: 'type', key: 'task' },
  properties: [
    { object: 'property', key: 'done', format: 'checkbox', checkbox: false },
    date('created_date', '2026-09-11T14:48:48Z'),
    ...properties
  ],
  ...extra
})

describe('a single date', () => {
  test("searches the type for a From inside the window, and resolves each object's date", async () => {
    const { gateway, calls } = setup(
      page([object('obj_1', 'Test Task', [date('due_date', '2026-09-13T22:00:00Z')])])
    )

    await expect(gateway.listObjects(API_KEY, TASKS, WINDOW)).resolves.toEqual({
      ok: true,
      value: [{ id: 'obj_1', title: 'Test Task', start: Date.parse('2026-09-13T22:00:00Z'), end: null }]
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(`${BASE}/v1/spaces/${SPACE_ID}/search?offset=0&limit=1000`)
    expect(calls[0]?.init.method).toBe('POST')
    expect(calls[0]?.init.headers).toMatchObject({ Authorization: `Bearer ${API_KEY}` })
    expect(JSON.parse(calls[0]?.init.body ?? '')).toEqual({
      types: ['task'],
      filters: {
        operator: 'and',
        conditions: [
          { property_key: 'due_date', condition: 'gte', date: '2026-08-31T22:00:00.000Z' },
          { property_key: 'due_date', condition: 'lte', date: '2026-09-30T21:59:59.999Z' }
        ]
      }
    })
  })

  test('carries no end, even when the object has other dates', async () => {
    const { gateway } = setup(
      page([object('obj_1', 'Task', [date('due_date', '2026-09-02T08:00:00Z'), date('start_date', '2026-09-01T08:00:00Z')])])
    )
    const result = await gateway.listObjects(API_KEY, TASKS, WINDOW)
    expect(result.ok && result.value[0]?.end).toBeNull()
  })
})

describe('a range', () => {
  test('searches for a From before the window ends and a To or From after it starts', async () => {
    const { gateway, calls } = setup(
      page([
        object('obj_1', 'Launch', [
          date('start_date', '2026-08-27T22:00:00Z'),
          date('due_date', '2026-09-02T22:00:00Z')
        ])
      ])
    )

    await expect(gateway.listObjects(API_KEY, PROJECTS, WINDOW)).resolves.toEqual({
      ok: true,
      value: [
        {
          id: 'obj_1',
          title: 'Launch',
          start: Date.parse('2026-08-27T22:00:00Z'),
          end: Date.parse('2026-09-02T22:00:00Z')
        }
      ]
    })
    expect(JSON.parse(calls[0]?.init.body ?? '')).toEqual({
      types: ['project'],
      filters: {
        operator: 'and',
        conditions: [
          { property_key: 'start_date', condition: 'nempty' },
          { property_key: 'start_date', condition: 'lte', date: '2026-09-30T21:59:59.999Z' }
        ],
        filters: [
          {
            operator: 'or',
            conditions: [
              { property_key: 'due_date', condition: 'gte', date: '2026-08-31T22:00:00.000Z' },
              { property_key: 'start_date', condition: 'gte', date: '2026-08-31T22:00:00.000Z' }
            ]
          }
        ]
      }
    })
  })

  test('carries a null end for an object with no To value', async () => {
    const { gateway } = setup(page([object('obj_1', 'Open', [date('start_date', '2026-09-03T22:00:00Z')])]))
    const result = await gateway.listObjects(API_KEY, PROJECTS, WINDOW)
    expect(result.ok && result.value).toEqual([
      { id: 'obj_1', title: 'Open', start: Date.parse('2026-09-03T22:00:00Z'), end: null }
    ])
  })
})

test('follows the pages until Anytype has no more', async () => {
  const { gateway, calls } = setup(
    page(
      [
        object('obj_1', 'One', [date('due_date', '2026-09-01T08:00:00Z')]),
        object('obj_2', 'Two', [date('due_date', '2026-09-02T08:00:00Z')])
      ],
      true
    ),
    page([object('obj_3', 'Three', [date('due_date', '2026-09-03T08:00:00Z')])])
  )

  const result = await gateway.listObjects(API_KEY, TASKS, WINDOW)

  expect(result.ok && result.value.map(({ id }) => id)).toEqual(['obj_1', 'obj_2', 'obj_3'])
  expect(calls[1]?.url).toBe(`${BASE}/v1/spaces/${SPACE_ID}/search?offset=2&limit=1000`)
  expect(calls[1]?.init.body).toBe(calls[0]?.init.body)
})

test('stops at an empty page even if it claims more', async () => {
  const { gateway, calls } = setup(
    page([object('obj_1', 'One', [date('due_date', '2026-09-01T08:00:00Z')])], true),
    page([], true)
  )
  await gateway.listObjects(API_KEY, TASKS, WINDOW)
  expect(calls).toHaveLength(2)
})

test('leaves out archived objects and objects with no From value', async () => {
  const { gateway } = setup(
    page([
      object('obj_1', 'Kept', [date('due_date', '2026-09-01T08:00:00Z')]),
      object('obj_2', 'Archived', [date('due_date', '2026-09-01T08:00:00Z')], { archived: true }),
      object('obj_3', 'Undated', [])
    ])
  )
  const result = await gateway.listObjects(API_KEY, TASKS, WINDOW)
  expect(result.ok && result.value.map(({ id }) => id)).toEqual(['obj_1'])
})

test('titles an object with no name as empty', async () => {
  const { gateway } = setup(
    page([object('obj_1', '', [date('due_date', '2026-09-01T08:00:00Z')], { name: undefined })])
  )
  const result = await gateway.listObjects(API_KEY, TASKS, WINDOW)
  expect(result.ok && result.value[0]?.title).toBe('')
})

test('encodes the space id into the path', async () => {
  const { gateway, calls } = setup(page([]))
  await gateway.listObjects(API_KEY, { ...TASKS, spaceId: 'a/b' }, WINDOW)
  expect(calls[0]?.url).toBe(`${BASE}/v1/spaces/a%2Fb/search?offset=0&limit=1000`)
})

test('resolves a refused key as unauthorized', async () => {
  const { gateway } = setup({
    status: 401,
    body: { object: 'error', status: 401, code: 'unauthorized', message: 'invalid api key' }
  })
  await expect(gateway.listObjects(API_KEY, TASKS, WINDOW)).resolves.toEqual({
    ok: false,
    failure: 'unauthorized'
  })
})

test('resolves no objects when Anytype cannot filter on the property', async () => {
  const { gateway } = setup({
    status: 400,
    body: { object: 'error', status: 400, code: 'bad_request', message: 'failed to build expression filters' }
  })
  await expect(gateway.listObjects(API_KEY, TASKS, WINDOW)).resolves.toEqual({ ok: true, value: [] })
})

test('rejects on any other error status', async () => {
  const { gateway } = setup({ status: 500, body: { object: 'error', code: 'internal_server_error' } })
  await expect(gateway.listObjects(API_KEY, TASKS, WINDOW)).rejects.toThrow('500')
})

describe('malformed answers', () => {
  test.each([
    ['the body is not a page', { status: 200, body: { objects: [] } }],
    ['the page has no has_more', { status: 200, body: { data: [], pagination: {} } }],
    ['an object has no id', page([{ name: 'No id', properties: [] }])],
    ['an object has no properties', page([{ id: 'obj_1', name: 'No properties' }])],
    ['a date is not a string', page([object('obj_1', 'Bad', [{ key: 'due_date', format: 'date', date: 42 }])])],
    ['a date does not parse', page([object('obj_1', 'Bad', [date('due_date', 'next tuesday')])])]
  ])('rejects when %s', async (_, reply) => {
    const { gateway } = setup(reply)
    await expect(gateway.listObjects(API_KEY, TASKS, WINDOW)).rejects.toThrow('objects')
  })

  test('rejects when a To date does not parse', async () => {
    const { gateway } = setup(
      page([object('obj_1', 'Bad', [date('start_date', '2026-09-01T08:00:00Z'), date('due_date', '')])])
    )
    await expect(gateway.listObjects(API_KEY, PROJECTS, WINDOW)).rejects.toThrow('objects')
  })
})

test('rejects when Anytype cannot be reached', async () => {
  const gateway = new AnytypeEventsGateway(
    new AnytypeClient({
      fetch: async () => {
        throw new TypeError('fetch failed')
      }
    })
  )
  await expect(gateway.listObjects(API_KEY, TASKS, WINDOW)).rejects.toThrow('fetch failed')
})
