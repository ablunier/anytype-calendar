import { describe, expect, test } from 'vitest'
import {
  AnytypeClient,
  AnytypeDialectProbe,
  type AnytypeFetch
} from '@anytype-calendar/anytype-client/infrastructure'
import type { EventsSource } from '../../domain'
import { AnytypeV2EventsGateway } from './anytype-v2-events-gateway'

type FetchCall = { url: string; init: Parameters<AnytypeFetch>[1] }
type Reply = { status: number; body: unknown }

const API_KEY = 'ak_secret'
const BASE = 'http://127.0.0.1:31009'
const SPACE_ID = 'bafy.space'

const APPOINTMENTS: EventsSource = {
  spaceId: SPACE_ID,
  typeKey: 'appointment',
  from: 'data',
  to: null,
  includesTime: true
}
const PROJECTS: EventsSource = {
  spaceId: SPACE_ID,
  typeKey: 'project',
  from: 'start_date',
  to: 'finish_date',
  includesTime: false
}

/** September 2026 two hours ahead of UTC. */
const WINDOW = { start: Date.parse('2026-08-31T22:00:00Z'), end: Date.parse('2026-09-30T21:59:59.999Z') }
const START_SECONDS = Date.parse('2026-08-31T22:00:00Z') / 1000
const END_SECONDS = Date.parse('2026-09-30T22:00:00Z') / 1000

function setup(...replies: (Reply | { status: number; text: string })[]) {
  const calls: FetchCall[] = []
  const client = new AnytypeClient({
    fetch: async (url, init) => {
      calls.push({ url, init })
      const reply = replies[Math.min(calls.length, replies.length) - 1]
      if (!reply) throw new Error('no reply scripted')
      const text = 'text' in reply ? reply.text : JSON.stringify(reply.body)
      return { status: reply.status, text: async () => text }
    }
  })
  const probe = new AnytypeDialectProbe({ client })
  return { gateway: new AnytypeV2EventsGateway({ client, probe }), probe, calls }
}

const page = (data: unknown[], hasMore = false): Reply => ({
  status: 200,
  body: { data, total: data.length, offset: 0, limit: 1000, has_more: hasMore }
})

/** Shaped like a real v2 search row: only the fields asked for, an empty date left out. */
const row = (id: string, name: string, properties: Record<string, unknown>) => ({
  id,
  name,
  type: 'appointment',
  properties
})

const v2Error = (status: number, code: string): Reply => ({
  status,
  body: { status, code, message: code, issues: [] }
})

describe('a single date', () => {
  test("searches the type for a From inside the window, and resolves each object's date", async () => {
    const { gateway, calls } = setup(page([row('obj_1', 'Padel', { data: '2026-09-26T09:00:00Z' })]))

    await expect(gateway.listObjects(API_KEY, APPOINTMENTS, WINDOW)).resolves.toEqual({
      ok: true,
      value: [{ id: 'obj_1', title: 'Padel', start: Date.parse('2026-09-26T09:00:00Z'), end: null }]
    })
    expect(calls[0]?.url).toBe(`${BASE}/v2/spaces/${SPACE_ID}/search?offset=0&limit=1000`)
    expect(calls[0]?.init.method).toBe('POST')
    expect(calls[0]?.init.headers).toMatchObject({ Authorization: `Bearer ${API_KEY}` })
    expect(JSON.parse(calls[0]?.init.body ?? '')).toEqual({
      type: 'appointment',
      filters: [
        { property: 'data', condition: 'not_empty' },
        { property: 'data', condition: 'greater_or_equal', value: START_SECONDS },
        { property: 'data', condition: 'less_or_equal', value: END_SECONDS }
      ],
      fields: ['data']
    })
  })
})

describe('a range', () => {
  test('searches for a From before the window ends and a To or From after it starts', async () => {
    const { gateway, calls } = setup(
      page([
        row('obj_1', 'Beta 1', { start_date: '2026-09-08T22:00:00Z', finish_date: '2026-09-15T22:00:00Z' })
      ])
    )

    await expect(gateway.listObjects(API_KEY, PROJECTS, WINDOW)).resolves.toEqual({
      ok: true,
      value: [
        {
          id: 'obj_1',
          title: 'Beta 1',
          start: Date.parse('2026-09-08T22:00:00Z'),
          end: Date.parse('2026-09-15T22:00:00Z')
        }
      ]
    })
    expect(JSON.parse(calls[0]?.init.body ?? '')).toEqual({
      type: 'project',
      filters: [
        { property: 'start_date', condition: 'not_empty' },
        { property: 'start_date', condition: 'less_or_equal', value: END_SECONDS },
        {
          operator: 'or',
          filters: [
            { property: 'finish_date', condition: 'greater_or_equal', value: START_SECONDS },
            { property: 'start_date', condition: 'greater_or_equal', value: START_SECONDS }
          ]
        }
      ],
      fields: ['start_date', 'finish_date']
    })
  })

  test('carries a null end for an object with no To value', async () => {
    const { gateway } = setup(page([row('obj_1', 'Open', { start_date: '2026-09-03T22:00:00Z' })]))
    const result = await gateway.listObjects(API_KEY, PROJECTS, WINDOW)
    expect(result.ok && result.value[0]?.end).toBeNull()
  })

  test('carries a null end for a To served as null', async () => {
    const { gateway } = setup(
      page([row('obj_1', 'Open', { start_date: '2026-09-03T22:00:00Z', finish_date: null })])
    )
    const result = await gateway.listObjects(API_KEY, PROJECTS, WINDOW)
    expect(result.ok && result.value[0]?.end).toBeNull()
  })
})

test('follows the pages until Anytype has no more', async () => {
  const { gateway, calls } = setup(
    page([row('obj_1', 'One', { data: '2026-09-01T08:00:00Z' })], true),
    page([row('obj_2', 'Two', { data: '2026-09-02T08:00:00Z' })])
  )

  const result = await gateway.listObjects(API_KEY, APPOINTMENTS, WINDOW)

  expect(result.ok && result.value.map(({ id }) => id)).toEqual(['obj_1', 'obj_2'])
  expect(calls[1]?.url).toBe(`${BASE}/v2/spaces/${SPACE_ID}/search?offset=1&limit=1000`)
  expect(calls[1]?.init.body).toBe(calls[0]?.init.body)
})

test('stops at an empty page even if it claims more', async () => {
  const { gateway, calls } = setup(page([row('obj_1', 'One', { data: '2026-09-01T08:00:00Z' })], true), page([], true))
  await gateway.listObjects(API_KEY, APPOINTMENTS, WINDOW)
  expect(calls).toHaveLength(2)
})

test('leaves out objects with no From value, and titles a nameless one as empty', async () => {
  const { gateway } = setup(
    page([{ id: 'obj_1', properties: { data: '2026-09-01T08:00:00Z' } }, row('obj_2', 'Undated', {})])
  )
  const result = await gateway.listObjects(API_KEY, APPOINTMENTS, WINDOW)
  expect(result.ok && result.value.map(({ id, title }) => [id, title])).toEqual([['obj_1', '']])
})

test('resolves a refused key as unauthorized', async () => {
  const { gateway } = setup({
    status: 401,
    body: { object: 'error', status: 401, code: 'unauthorized', message: 'invalid api key' }
  })
  await expect(gateway.listObjects(API_KEY, APPOINTMENTS, WINDOW)).resolves.toEqual({
    ok: false,
    failure: 'unauthorized'
  })
})

test.each([
  ['a property or type the space does not have', v2Error(400, 'validation_failed')],
  ['a space the key was not granted', v2Error(403, 'space_not_granted')],
  ['a space that is not open', v2Error(404, 'not_found')]
])('resolves no objects for %s', async (_, reply) => {
  const { gateway } = setup(reply)
  await expect(gateway.listObjects(API_KEY, APPOINTMENTS, WINDOW)).resolves.toEqual({ ok: true, value: [] })
})

test('rejects on any other error status', async () => {
  const { gateway } = setup(v2Error(500, 'internal'))
  await expect(gateway.listObjects(API_KEY, APPOINTMENTS, WINDOW)).rejects.toThrow('500')
})

test('rejects, and forgets the dialect, when Anytype no longer has the v2 route', async () => {
  const { gateway, probe, calls } = setup(
    { status: 200, body: {} },
    { status: 404, text: '404 page not found' },
    { status: 200, body: {} }
  )
  await probe.probe(API_KEY)

  await expect(gateway.listObjects(API_KEY, APPOINTMENTS, WINDOW)).rejects.toThrow('404')
  await probe.probe(API_KEY)

  expect(calls.filter(({ url }) => url.includes('/whoami'))).toHaveLength(2)
})

describe('malformed answers', () => {
  test.each([
    ['the body is not a v2 page', { status: 200, body: { data: [], pagination: { has_more: false } } }],
    ['an object has no id', page([{ name: 'No id', properties: {} }])],
    ['a date is not a string', page([row('obj_1', 'Bad', { data: 42 })])],
    ['a date does not parse', page([row('obj_1', 'Bad', { data: 'next tuesday' })])]
  ])('rejects when %s', async (_, reply) => {
    const { gateway } = setup(reply)
    await expect(gateway.listObjects(API_KEY, APPOINTMENTS, WINDOW)).rejects.toThrow('objects')
  })
})
