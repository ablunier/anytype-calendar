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
  spaceId: 'sp_1',
  typeKey: 'task',
  from: 'due_date',
  to: null,
  includesTime: false
}
const PROJECTS: EventsSource = {
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

test('seeds the design sample around the current month by default', async () => {
  const { gateway } = setup()
  const window = monthWindow(DECEMBER)
  const tasks = await gateway.listObjects('ak_any', {
    spaceId: 'sp_personal',
    typeKey: 'task',
    from: 'due_date',
    to: null
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
