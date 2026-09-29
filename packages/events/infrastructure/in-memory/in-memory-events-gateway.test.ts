import { expect, test } from 'vitest'
import {
  overlapsEventsWindow,
  shiftEventsMonth,
  type EventsMonth,
  type EventsSource,
  type EventsTimeZone,
  type EventsWindow
} from '../../domain'
import { InMemoryEventsGateway, inMemoryEventsSample, type InMemoryEventsObject } from './in-memory-events-gateway'

const UTC: EventsTimeZone = {
  startOfDay: ({ year, month, day }) => Date.UTC(year, month, day),
  at: ({ year, month, day }, minute) => Date.UTC(year, month, day, 0, minute),
  dayOf: (instant) => {
    const date = new Date(instant)
    return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() }
  }
}

const NOW = Date.UTC(2026, 11, 14, 9)
const DECEMBER = { year: 2026, month: 11 }

/* The calendar month exactly. A month span is read with a week of slack either side, for the
 * grid rows it shares with its neighbours, which would blur what these seeds are placed
 * against. */
const monthWindow = ({ year, month }: EventsMonth): EventsWindow => ({
  start: Date.UTC(year, month, 1),
  end: Date.UTC(year, month + 1, 1) - 1
})

const TASKS: EventsSource = {
  kind: 'type',
  spaceId: 'sp_1',
  typeKey: 'task',
  from: 'due_date',
  to: null,
  includesTime: false
}
const PROJECTS: EventsSource = {
  kind: 'type',
  spaceId: 'sp_1',
  typeKey: 'project',
  from: 'start_date',
  to: 'due_date',
  includesTime: false
}

const OBJECTS: InMemoryEventsObject[] = [
  { id: 'o1', spaceId: 'sp_1', typeKey: 'task', title: 'Task', dates: { due_date: 1_000 } },
  { id: 'o2', spaceId: 'sp_2', typeKey: 'task', title: 'Elsewhere', dates: { due_date: 1_000 } },
  { id: 'o3', spaceId: 'sp_1', typeKey: 'task', title: 'Undated', dates: {} },
  { id: 'o4', spaceId: 'sp_1', typeKey: 'project', title: 'Range', dates: { start_date: 1_000, due_date: 5_000 } },
  { id: 'o5', spaceId: 'sp_1', typeKey: 'project', title: 'Open', dates: { start_date: 2_000 } }
]

function setup(objects?: InMemoryEventsObject[]) {
  const sleeps: number[] = []
  const gateway = new InMemoryEventsGateway({
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    zone: UTC,
    now: () => NOW,
    requestLatencyMs: 50,
    ...(objects ? { objects } : {})
  })
  return { gateway, sleeps }
}

test("answers with the source's dated objects after the simulated latency", async () => {
  const { gateway, sleeps } = setup(OBJECTS)
  await expect(gateway.listObjects('ak_any', TASKS)).resolves.toEqual({
    ok: true,
    value: [{ id: 'o1', title: 'Task', start: 1_000, end: null }]
  })
  expect(sleeps).toEqual([50])
})

test('carries the To value of a range, and null where it is missing', async () => {
  const { gateway } = setup(OBJECTS)
  const result = await gateway.listObjects('ak_any', PROJECTS)
  expect(result.ok && result.value).toEqual([
    { id: 'o4', title: 'Range', start: 1_000, end: 5_000 },
    { id: 'o5', title: 'Open', start: 2_000, end: null }
  ])
})

test('carries Done, Location and the colour-by option only where the source names them', async () => {
  const detailed: InMemoryEventsObject = {
    ...OBJECTS[0]!,
    done: true,
    location: 'Home',
    options: { priority: 'High' }
  }
  const { gateway } = setup([detailed])
  const source: EventsSource = {
    ...TASKS,
    done: 'done',
    location: 'location',
    colourBy: { key: 'priority', options: [] }
  }

  await expect(gateway.listObjects('ak_any', source)).resolves.toEqual({
    ok: true,
    value: [{ id: 'o1', title: 'Task', start: 1_000, end: null, done: true, location: 'Home', option: 'High' }]
  })
  await expect(gateway.listObjects('ak_any', TASKS)).resolves.toEqual({
    ok: true,
    value: [{ id: 'o1', title: 'Task', start: 1_000, end: null }]
  })
})

test("answers a query with its type's objects its view keeps, reading the first view by default", async () => {
  const sleeps: number[] = []
  const gateway = new InMemoryEventsGateway({
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    zone: UTC,
    now: () => NOW,
    objects: [OBJECTS[0]!, { ...OBJECTS[0]!, id: 'o6', title: 'Finished', done: true }, OBJECTS[3]!],
    queries: [
      {
        id: 'q_open',
        spaceId: 'sp_1',
        typeKey: 'task',
        views: [
          { id: 'v_open', openOnly: true },
          { id: 'v_all', openOnly: false }
        ]
      }
    ]
  })
  const query = (viewId: string | null, queryId = 'q_open'): EventsSource => ({
    kind: 'query',
    spaceId: 'sp_1',
    queryId,
    viewId,
    from: 'due_date',
    to: null,
    includesTime: false
  })
  const ids = async (source: EventsSource): Promise<string[]> => {
    const result = await gateway.listObjects('ak_any', source)
    return result.ok ? result.value.map(({ id }) => id) : []
  }

  expect(await ids(query(null))).toEqual(['o1'])
  expect(await ids(query('v_all'))).toEqual(['o1', 'o6'])
  expect(await ids(query('v_gone'))).toEqual([])
  expect(await ids(query(null, 'q_gone'))).toEqual([])
})

test('seeds the design sample around the current month by default', async () => {
  const { gateway } = setup()
  const window = monthWindow(DECEMBER)
  const tasks = await gateway.listObjects('ak_any', {
    kind: 'type',
    spaceId: 'sp_personal',
    typeKey: 'task',
    from: 'due_date',
    to: null,
    includesTime: false
  })
  const inDecember = tasks.ok ? tasks.value.filter((ref) => overlapsEventsWindow(ref, window)) : []
  expect(inDecember.map(({ title }) => title)).toContain('Reply to Iris')
})

test('seeds a range running into the next month, and one running in from the last', () => {
  const sample = inMemoryEventsSample(DECEMBER, UTC)
  const window = monthWindow(DECEMBER)
  const book = sample.find(({ title }) => title === 'The Dawn of Everything')
  const project = sample.find(({ title }) => title === 'Onboarding revamp')

  expect(book?.dates['start_date']).toBeLessThanOrEqual(window.end)
  expect(book?.dates['finish_date']).toBeGreaterThan(window.end)
  expect(project?.dates['start_date']).toBeLessThan(window.start)
  expect(project?.dates['due_date']).toBeGreaterThanOrEqual(window.start)
})

test('seeds something in the months after the year turns', () => {
  const sample = inMemoryEventsSample(DECEMBER, UTC)
  const january = monthWindow(shiftEventsMonth(DECEMBER, 1))
  const inJanuary = sample.filter(({ dates }) =>
    Object.values(dates).some((instant) => instant >= january.start && instant <= january.end)
  )
  expect(inJanuary.length).toBeGreaterThan(0)
})

test('seeds timed dates at their time of day', () => {
  const sample = inMemoryEventsSample(DECEMBER, UTC)
  const notes = sample.find(({ title }) => title === 'Draft API notes')
  expect(notes?.dates['due_date']).toBe(Date.UTC(2026, 11, 3, 14, 30))
})

test('gives every seeded object its own id', () => {
  const ids = inMemoryEventsSample(DECEMBER, UTC).map(({ id }) => id)
  expect(new Set(ids).size).toBe(ids.length)
})

test('moves, ticks and creates objects, which the next read answers', async () => {
  const { gateway } = setup(OBJECTS)
  const window = { start: 0, end: 10_000 }

  await expect(gateway.reschedule('k', { spaceId: 'sp_1', id: 'o4' }, { start_date: 3_000, due_date: 6_000 })).resolves.toEqual({
    ok: true,
    value: null
  })
  await gateway.setDone('k', { spaceId: 'sp_1', id: 'o1' }, 'done', true)
  await expect(
    gateway.create('k', { spaceId: 'sp_1', typeKey: 'project', name: 'New', dates: { start_date: 4_000 } })
  ).resolves.toEqual({ ok: true, value: { id: 'obj_new_1' } })

  const projects = await gateway.listObjects('k', PROJECTS, window)
  expect(projects.ok && projects.value).toEqual([
    { id: 'o4', title: 'Range', start: 3_000, end: 6_000 },
    { id: 'o5', title: 'Open', start: 2_000, end: null },
    { id: 'obj_new_1', title: 'New', start: 4_000, end: null }
  ])
  const tasks = await gateway.listObjects('k', { ...TASKS, done: 'done' }, window)
  expect(tasks.ok && tasks.value[0]).toMatchObject({ id: 'o1', done: true })
  // The objects it was given are its own copies.
  expect(OBJECTS[0]?.done).toBeUndefined()
})

test('refuses to write an object it does not have', async () => {
  const { gateway } = setup(OBJECTS)
  await expect(gateway.setDone('k', { spaceId: 'sp_2', id: 'o1' }, 'done', true)).resolves.toMatchObject({
    ok: false,
    failure: 'rejected'
  })
})
