import { describe, expect, test } from 'vitest'
import { AnytypeClient, type AnytypeFetch } from '@ablunier/anytype-client'
import type { EventsSource } from '../../domain'
import { AnytypeV2EventsGateway } from './anytype-v2-events-gateway'

type FetchCall = { url: string; init: Parameters<AnytypeFetch>[1] }
type Reply = { status: number; body: unknown }

const API_KEY = 'ak_secret'
const BASE = 'http://127.0.0.1:31009'
const SPACE_ID = 'bafy.space'

const APPOINTMENTS: EventsSource = {
  kind: 'type',
  spaceId: SPACE_ID,
  typeKey: 'appointment',
  from: 'data',
  to: null,
  includesTime: true
}
const PROJECTS: EventsSource = {
  kind: 'type',
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
  const warnings: string[] = []
  const warn = (message: string): void => {
    warnings.push(message)
  }
  return { gateway: new AnytypeV2EventsGateway({ client, warn }), calls, warnings }
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
      filters: [
        { property: 'type', condition: 'equal', value: 'appointment' },
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
      filters: [
        { property: 'type', condition: 'equal', value: 'project' },
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

describe('Done, Location and colour', () => {
  const TASKS: EventsSource = {
    ...APPOINTMENTS,
    typeKey: 'task',
    from: 'due_date',
    done: 'done',
    location: 'location',
    colourBy: { key: '6aaa4502', options: [{ name: 'P4', color: 'grey' }] }
  }

  test('asks for them only where the source names them', async () => {
    const { gateway, calls } = setup(page([]), page([]))

    await gateway.listObjects(API_KEY, TASKS, WINDOW)
    await gateway.listObjects(API_KEY, APPOINTMENTS, WINDOW)

    expect(JSON.parse(calls[0]?.init.body ?? '').fields).toEqual(['due_date', 'done', 'location', '6aaa4502'])
    expect(JSON.parse(calls[1]?.init.body ?? '').fields).toEqual(['data'])
  })

  test('resolves them, reading an absent Done as not done', async () => {
    const { gateway } = setup(
      page([
        row('obj_1', 'Allergist', {
          due_date: '2027-06-01T13:45:00Z',
          done: true,
          location: 'Clinic',
          '6aaa4502': ['P4']
        }),
        row('obj_2', 'Cancel subscription', { due_date: '2027-06-02T10:00:00Z' })
      ])
    )

    const result = await gateway.listObjects(API_KEY, TASKS, WINDOW)

    expect(result.ok && result.value).toEqual([
      {
        id: 'obj_1',
        title: 'Allergist',
        start: Date.parse('2027-06-01T13:45:00Z'),
        end: null,
        done: true,
        location: 'Clinic',
        option: 'P4'
      },
      { id: 'obj_2', title: 'Cancel subscription', start: Date.parse('2027-06-02T10:00:00Z'), end: null, done: false }
    ])
  })

  test('leaves them out for a source that does not name them', async () => {
    const { gateway } = setup(page([row('obj_1', 'Padel', { data: '2026-09-26T09:00:00Z', done: true })]))
    const result = await gateway.listObjects(API_KEY, APPOINTMENTS, WINDOW)
    expect(result.ok && result.value[0]).not.toHaveProperty('done')
  })
})

describe('panel properties', () => {
  const JOBS: EventsSource = {
    ...APPOINTMENTS,
    typeKey: 'job',
    from: 'applied',
    colourBy: { key: 'status', options: [{ name: 'Applied', color: 'red' }] },
    panel: [
      { key: 'salary', format: 'text' },
      { key: 'openings', format: 'number' },
      { key: 'status', format: 'select', options: [{ name: 'Applied', color: 'red' }] },
      { key: 'tags', format: 'multi_select', options: [] },
      { key: 'site', format: 'url' },
      { key: 'mail', format: 'email' },
      { key: 'phone', format: 'phone' },
      { key: 'contacts', format: 'objects' }
    ]
  }
  const detailsOf = async (properties: Record<string, unknown>) => {
    const { gateway } = setup(page([row('obj_1', 'Acme', { applied: '2026-09-10T10:00:00Z', ...properties })]))
    const result = await gateway.listObjects(API_KEY, JOBS, WINDOW)
    return result.ok ? result.value[0]?.details : result
  }

  test('asks for them after the rest, each key once', async () => {
    const { gateway, calls } = setup(page([]))
    await gateway.listObjects(API_KEY, JOBS, WINDOW)
    expect(JSON.parse(calls[0]?.init.body ?? '').fields).toEqual([
      'applied',
      'status',
      'salary',
      'openings',
      'tags',
      'site',
      'mail',
      'phone',
      'contacts'
    ])
  })

  test('asks a query for them too', async () => {
    const { gateway, calls } = setup(page([]))
    await gateway.listObjects(API_KEY, { ...JOBS, kind: 'query', queryId: 'q1', viewId: null }, WINDOW)
    expect(calls[0]?.url).toContain('fields=applied,status,salary,openings,tags,site,mail,phone,contacts')
  })

  test('reads each by its format, options by name and linked objects by id', async () => {
    await expect(
      detailsOf({
        salary: '40–50k',
        openings: 2,
        status: ['Applied'],
        tags: ['Remote', 'bafyreideletedoption'],
        site: 'https://acme.example',
        mail: 'jobs@acme.example',
        phone: '+34 600 000 000',
        contacts: ['obj_2', 'participant-A8x']
      })
    ).resolves.toEqual([
      { key: 'salary', format: 'text', value: '40–50k' },
      { key: 'openings', format: 'number', value: 2 },
      { key: 'status', format: 'select', names: ['Applied'] },
      { key: 'tags', format: 'multi_select', names: ['Remote', 'bafyreideletedoption'] },
      { key: 'site', format: 'url', value: 'https://acme.example' },
      { key: 'mail', format: 'email', value: 'jobs@acme.example' },
      { key: 'phone', format: 'phone', value: '+34 600 000 000' },
      { key: 'contacts', format: 'objects', ids: ['obj_2', 'participant-A8x'] }
    ])
  })

  test('reads a value left out, null, empty or an empty list as none', async () => {
    await expect(
      detailsOf({ salary: '', openings: null, status: [], tags: null, site: null, contacts: [] })
    ).resolves.toBeUndefined()
  })

  test('drops a value of another shape than its format', async () => {
    await expect(
      detailsOf({ salary: 40, openings: '2', status: [3], site: ['https://acme.example'], contacts: { id: 'x' } })
    ).resolves.toBeUndefined()
  })

  test('reads a bare option name or id as a list of one', async () => {
    await expect(detailsOf({ status: 'Applied', contacts: 'obj_2' })).resolves.toEqual([
      { key: 'status', format: 'select', names: ['Applied'] },
      { key: 'contacts', format: 'objects', ids: ['obj_2'] }
    ])
  })
})

describe('listLinkedObjects', () => {
  const SEARCH = `${BASE}/v2/spaces/${SPACE_ID}/search?offset=0&limit=1000`
  const MEMBERS = `${BASE}/v2/spaces/${SPACE_ID}/members?offset=0&limit=1000`
  const member = (identity: string, name: string) => ({
    id: `participant-${identity}`,
    name,
    role: 'editor',
    identity
  })

  test('searches the space for the objects by id, and names them', async () => {
    const { gateway, calls } = setup(page([{ id: 'obj_1', name: 'Acme' }, { id: 'obj_2', name: '' }]))

    await expect(gateway.listLinkedObjects(API_KEY, SPACE_ID, ['obj_1', 'obj_2', 'obj_gone'])).resolves.toEqual({
      ok: true,
      value: [
        { id: 'obj_1', name: 'Acme', member: false },
        { id: 'obj_2', name: '', member: false }
      ]
    })
    expect(calls.map(({ url }) => url)).toEqual([SEARCH])
    expect(JSON.parse(calls[0]?.init.body ?? '')).toEqual({
      filters: [{ property: 'id', condition: 'in', value: ['obj_1', 'obj_2', 'obj_gone'] }]
    })
  })

  test('searches a thousand ids at a time', async () => {
    const ids = Array.from({ length: 1001 }, (_, index) => `obj_${index}`)
    const { gateway, calls } = setup(page([]))
    await gateway.listLinkedObjects(API_KEY, SPACE_ID, ids)
    expect(calls.map(({ init }) => JSON.parse(init.body ?? '').filters[0].value.length)).toEqual([1000, 1])
  })

  test("matches members, which no search finds, on the space's members' identity", async () => {
    const { gateway, calls } = setup(page([member('A8x', 'Mara'), member('A8y', 'Sofia')]))

    await expect(gateway.listLinkedObjects(API_KEY, SPACE_ID, ['participant-A8x', 'participant-A8z'])).resolves.toEqual({
      ok: true,
      value: [{ id: 'participant-A8x', name: 'Mara', member: true }]
    })
    expect(calls.map(({ url }) => url)).toEqual([MEMBERS])
  })

  test('reads both when both are linked', async () => {
    const { gateway, calls } = setup(page([{ id: 'obj_1', name: 'Acme' }]), page([member('A8x', 'Mara')]))

    const result = await gateway.listLinkedObjects(API_KEY, SPACE_ID, ['participant-A8x', 'obj_1'])

    expect(result).toEqual({
      ok: true,
      value: [
        { id: 'obj_1', name: 'Acme', member: false },
        { id: 'participant-A8x', name: 'Mara', member: true }
      ]
    })
    expect(calls.map(({ url }) => url)).toEqual([SEARCH, MEMBERS])
  })

  test.each([
    ['a space that is gone or not granted', v2Error(403, 'space_not_granted')],
    ['a build without the route', { status: 404, text: '404 page not found' }]
  ])('names nothing in %s', async (_, reply) => {
    const { gateway } = setup(reply)
    await expect(gateway.listLinkedObjects(API_KEY, SPACE_ID, ['participant-A8x'])).resolves.toEqual({
      ok: true,
      value: []
    })
  })

  test('resolves a refused key as unauthorized', async () => {
    const { gateway } = setup(v2Error(401, 'unauthorized'))
    await expect(gateway.listLinkedObjects(API_KEY, SPACE_ID, ['obj_1'])).resolves.toEqual({
      ok: false,
      failure: 'unauthorized'
    })
  })

  test('rejects on any other error status', async () => {
    const { gateway } = setup(v2Error(500, 'internal'))
    await expect(gateway.listLinkedObjects(API_KEY, SPACE_ID, ['obj_1'])).rejects.toThrow('500')
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

test('rejects when Anytype no longer has the v2 route', async () => {
  const { gateway } = setup({ status: 404, text: '404 page not found' })
  await expect(gateway.listObjects(API_KEY, APPOINTMENTS, WINDOW)).rejects.toThrow('404')
})

describe('a query', () => {
  const QUERY_ID = 'bafyreig35xn3pgwklcxro6eez4qn5afhdxe7yrtpafmrewry6gbtanbt5y'
  const OPEN_TASKS: EventsSource = {
    kind: 'query',
    spaceId: SPACE_ID,
    queryId: QUERY_ID,
    viewId: '63194',
    from: 'due_date',
    to: null,
    includesTime: true,
    done: 'done'
  }
  const OBJECTS = `${BASE}/v2/spaces/${SPACE_ID}/queries/${QUERY_ID}/objects`

  // As a real account answered, September 2026: an object with no due date has no properties.
  const answer = page([
    { id: 'obj_1', name: 'Cancelar LinkedIn premium', type: 'task' },
    { id: 'obj_2', name: 'Cita en alergoloxía', type: 'task', properties: { due_date: '2027-06-01T13:45:00Z' } }
  ])

  test('reads the query through its view, asking for the fields only, whatever the window', async () => {
    const { gateway, calls } = setup(answer)

    await expect(gateway.listObjects(API_KEY, OPEN_TASKS, WINDOW)).resolves.toEqual({
      ok: true,
      value: [
        {
          id: 'obj_2',
          title: 'Cita en alergoloxía',
          start: Date.parse('2027-06-01T13:45:00Z'),
          end: null,
          done: false
        }
      ]
    })
    expect(calls[0]?.url).toBe(`${OBJECTS}?view=63194&fields=due_date,done&offset=0&limit=1000`)
    expect(calls[0]?.init.method).toBe('GET')
  })

  test('reads the first view when none is chosen', async () => {
    const { gateway, calls } = setup(answer)
    await gateway.listObjects(API_KEY, { ...OPEN_TASKS, viewId: null }, WINDOW)
    expect(calls[0]?.url).toBe(`${OBJECTS}?fields=due_date,done&offset=0&limit=1000`)
  })

  test('follows the pages until Anytype has no more', async () => {
    const { gateway, calls } = setup(
      page([row('obj_1', 'A', { due_date: '2026-09-02T10:00:00Z' })], true),
      page([row('obj_2', 'B', { due_date: '2026-09-03T10:00:00Z' })])
    )
    const result = await gateway.listObjects(API_KEY, OPEN_TASKS, WINDOW)
    expect(result.ok && result.value.map(({ id }) => id)).toEqual(['obj_1', 'obj_2'])
    expect(calls[1]?.url).toBe(`${OBJECTS}?view=63194&fields=due_date,done&offset=1&limit=1000`)
  })

  test.each([
    ['a query or view that is gone', v2Error(404, 'not_found')],
    ['a field the space does not have', v2Error(400, 'validation_failed')],
    ['a space outside the grant', v2Error(403, 'space_not_granted')]
  ])('reads %s as no objects', async (_, reply) => {
    const { gateway } = setup(reply)
    await expect(gateway.listObjects(API_KEY, OPEN_TASKS, WINDOW)).resolves.toEqual({ ok: true, value: [] })
  })

  const warned = (path: string, message: string): Reply => ({
    status: 200,
    body: { data: [], total: 0, offset: 0, limit: 1000, has_more: false, warnings: [{ path, message, hint: 'x' }] }
  })

  test('tells what Anytype warned about, once however often the query is read', async () => {
    const { gateway, warnings } = setup(warned('view.filters', 'the calling member could not be resolved'))

    await gateway.listObjects(API_KEY, OPEN_TASKS, WINDOW)
    await gateway.listObjects(API_KEY, OPEN_TASKS, WINDOW)

    expect(warnings).toEqual(['Anytype warned when asked for objects: the calling member could not be resolved'])
  })

  test('does not tell which view was applied when none was chosen', async () => {
    const { gateway, warnings } = setup(warned('view', 'its first view "Open" was applied'))
    await gateway.listObjects(API_KEY, { ...OPEN_TASKS, viewId: null }, WINDOW)
    expect(warnings).toEqual([])
  })
})

describe('malformed answers', () => {
  test.each([
    ['an object has no id', page([{ name: 'No id', properties: {} }])],
    ['a date is not a string', page([row('obj_1', 'Bad', { data: 42 })])],
    ['a date does not parse', page([row('obj_1', 'Bad', { data: 'next tuesday' })])]
  ])('rejects when %s', async (_, reply) => {
    const { gateway } = setup(reply)
    await expect(gateway.listObjects(API_KEY, APPOINTMENTS, WINDOW)).rejects.toThrow('objects')
  })
})
