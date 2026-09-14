import { describe, expect, test, vi } from 'vitest'
import type {
  EventsGateway,
  EventsGatewayResult,
  EventsMonthLoad,
  EventsObjectRef,
  EventsSource,
  EventsTimeZone
} from '../domain'
import { EventsMonthStore } from './events-month-store'
import { LoadEventsMonth } from './load-events-month'
import { ResetEventsMonth } from './reset-events-month'

const API_KEY = 'ak_secret'
const NOW = Date.UTC(2026, 8, 14, 9, 30)
const HOUR_MS = 3_600_000

const UTC: EventsTimeZone = {
  startOfDay: ({ year, month, day }) => Date.UTC(year, month, day),
  dayOf: (instant) => {
    const date = new Date(instant)
    return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() }
  }
}

const SEPTEMBER = { year: 2026, month: 8 }
const OCTOBER = { year: 2026, month: 9 }
const DECEMBER = { year: 2026, month: 11 }

const TASKS: EventsSource = { spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null }
const PROJECTS: EventsSource = { spaceId: 'sp_2', typeKey: 'project', from: 'start_date', to: 'due_date' }

const ref = (id: string, start: number, end: number | null = null): EventsObjectRef => ({
  id,
  title: id,
  start,
  end
})

const ok = <T>(value: T): EventsGatewayResult<T> => ({ ok: true, value })
const unauthorized = { ok: false, failure: 'unauthorized' } as const

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function setup({
  apiKey = API_KEY as string | null,
  sources = [TASKS, PROJECTS],
  refs = {} as Record<string, EventsObjectRef[]>
} = {}) {
  const gateway = {
    listObjects: vi.fn<EventsGateway['listObjects']>(async (_key, source) => ok(refs[source.typeKey] ?? []))
  }
  const store = new EventsMonthStore()
  const loadEventsMonth = new LoadEventsMonth({
    gateway,
    apiKeys: { current: async () => apiKey },
    sources: { current: () => sources },
    zone: UTC,
    store,
    now: () => NOW
  })
  return { gateway, store, loadEventsMonth, reset: new ResetEventsMonth(store) }
}

test("asks each source for the month's window and keeps the objects that overlap it, in order", async () => {
  const { gateway, store, loadEventsMonth } = setup({
    refs: {
      task: [ref('late task', Date.UTC(2026, 8, 20, 15)), ref('august task', Date.UTC(2026, 7, 31))],
      project: [
        ref('spans in', Date.UTC(2026, 7, 28), Date.UTC(2026, 8, 2)),
        ref('ended before', Date.UTC(2026, 7, 1), Date.UTC(2026, 7, 31)),
        ref('runs out', Date.UTC(2026, 8, 29), Date.UTC(2026, 9, 3))
      ]
    }
  })

  await loadEventsMonth.execute(SEPTEMBER)

  const window = { start: Date.UTC(2026, 8, 1), end: Date.UTC(2026, 9, 1) - 1 }
  expect(gateway.listObjects).toHaveBeenCalledWith(API_KEY, TASKS, window)
  expect(gateway.listObjects).toHaveBeenCalledWith(API_KEY, PROJECTS, window)
  expect(store.get()).toEqual({
    phase: 'loaded',
    last: {
      month: SEPTEMBER,
      loadedAt: NOW,
      objects: [
        {
          id: 'spans in',
          spaceId: 'sp_2',
          typeKey: 'project',
          title: 'spans in',
          start: Date.UTC(2026, 7, 28),
          end: Date.UTC(2026, 8, 2),
          allDay: true
        },
        {
          id: 'late task',
          spaceId: 'sp_1',
          typeKey: 'task',
          title: 'late task',
          start: Date.UTC(2026, 8, 20, 15),
          end: null,
          allDay: false
        },
        {
          id: 'runs out',
          spaceId: 'sp_2',
          typeKey: 'project',
          title: 'runs out',
          start: Date.UTC(2026, 8, 29),
          end: Date.UTC(2026, 9, 3),
          allDay: true
        }
      ]
    }
  })
})

test('asks for December up to the first instant of the next year', async () => {
  const { gateway, loadEventsMonth } = setup({ sources: [TASKS] })
  await loadEventsMonth.execute(DECEMBER)
  expect(gateway.listObjects).toHaveBeenCalledWith(API_KEY, TASKS, {
    start: Date.UTC(2026, 11, 1),
    end: Date.UTC(2027, 0, 1) - 1
  })
})

test('is loaded and empty with nothing selected, asking Anytype nothing', async () => {
  const { gateway, store, loadEventsMonth } = setup({ sources: [] })
  await loadEventsMonth.execute(SEPTEMBER)
  expect(store.get()).toEqual({ phase: 'loaded', last: { month: SEPTEMBER, objects: [], loadedAt: NOW } })
  expect(gateway.listObjects).not.toHaveBeenCalled()
})

test('is loading while Anytype is being read', async () => {
  const { gateway, store, loadEventsMonth } = setup({ sources: [TASKS] })
  const answer = deferred<EventsGatewayResult<EventsObjectRef[]>>()
  gateway.listObjects.mockReturnValueOnce(answer.promise)

  const running = loadEventsMonth.execute(SEPTEMBER)
  await Promise.resolve()
  expect(store.get()).toEqual({ phase: 'loading', month: SEPTEMBER })

  answer.resolve(ok([]))
  await running
  expect(store.get()).toMatchObject({ phase: 'loaded' })
})

describe('without a month', () => {
  test('loads the current month before any', async () => {
    const { store, loadEventsMonth } = setup()
    await loadEventsMonth.execute()
    expect(store.get()).toMatchObject({ phase: 'loaded', last: { month: SEPTEMBER } })
  })

  test('reads the month on screen again', async () => {
    const { gateway, store, loadEventsMonth } = setup({ sources: [TASKS] })
    await loadEventsMonth.execute(DECEMBER)
    await loadEventsMonth.execute()
    expect(gateway.listObjects).toHaveBeenCalledTimes(2)
    expect(store.get()).toMatchObject({ phase: 'loaded', last: { month: DECEMBER } })
  })

  test('tries a failed month again', async () => {
    const { gateway, store, loadEventsMonth } = setup({ sources: [TASKS] })
    gateway.listObjects.mockRejectedValueOnce(new TypeError('fetch failed'))
    await loadEventsMonth.execute(OCTOBER)
    await loadEventsMonth.execute()
    expect(store.get()).toMatchObject({ phase: 'loaded', last: { month: OCTOBER } })
  })
})

test('reads the selection as it is when the load starts', async () => {
  let sources = [TASKS]
  const { gateway } = setup()
  const store = new EventsMonthStore()
  const loadEventsMonth = new LoadEventsMonth({
    gateway,
    apiKeys: { current: async () => API_KEY },
    sources: { current: () => sources },
    zone: UTC,
    store,
    now: () => NOW
  })
  await loadEventsMonth.execute(SEPTEMBER)
  sources = [PROJECTS]
  await loadEventsMonth.execute()
  expect(gateway.listObjects.mock.calls.map(([, source]) => source.typeKey)).toEqual(['task', 'project'])
})

test('fails as unauthorized without a stored key, asking Anytype nothing', async () => {
  const { gateway, store, loadEventsMonth } = setup({ apiKey: null })
  await loadEventsMonth.execute(SEPTEMBER)
  expect(store.get()).toEqual({ phase: 'failed', month: SEPTEMBER, failure: 'unauthorized', at: NOW })
  expect(gateway.listObjects).not.toHaveBeenCalled()
})

test('fails as unauthorized when a source is refused', async () => {
  const { gateway, store, loadEventsMonth } = setup()
  gateway.listObjects.mockResolvedValueOnce(unauthorized)
  await loadEventsMonth.execute(SEPTEMBER)
  expect(store.get()).toMatchObject({ phase: 'failed', failure: 'unauthorized' })
})

test('fails as unreachable when a request rejects', async () => {
  const { gateway, store, loadEventsMonth } = setup()
  gateway.listObjects.mockRejectedValueOnce(new TypeError('fetch failed'))
  await loadEventsMonth.execute(SEPTEMBER)
  expect(store.get()).toEqual({ phase: 'failed', month: SEPTEMBER, failure: 'unreachable', at: NOW })
})

test('keeps the last result through a failed reload', async () => {
  const { gateway, store, loadEventsMonth } = setup({
    sources: [TASKS],
    refs: { task: [ref('task', Date.UTC(2026, 8, 3, 10))] }
  })
  await loadEventsMonth.execute(SEPTEMBER)
  const { last } = store.get() as Extract<EventsMonthLoad, { phase: 'loaded' }>

  gateway.listObjects.mockRejectedValueOnce(new TypeError('fetch failed'))
  await loadEventsMonth.execute()

  expect(store.get()).toEqual({ phase: 'failed', month: SEPTEMBER, failure: 'unreachable', at: NOW, last })
})

describe('racing', () => {
  test('drops the result for a month the user already left', async () => {
    const { gateway, store, loadEventsMonth } = setup({
      sources: [TASKS],
      refs: { task: [ref('october task', Date.UTC(2026, 9, 5, 12))] }
    })
    const september = deferred<EventsGatewayResult<EventsObjectRef[]>>()
    gateway.listObjects.mockReturnValueOnce(september.promise)

    const leaving = loadEventsMonth.execute(SEPTEMBER)
    await loadEventsMonth.execute(OCTOBER)
    september.resolve(ok([ref('september task', Date.UTC(2026, 8, 5, 12))]))
    await leaving

    expect(store.get()).toMatchObject({
      phase: 'loaded',
      last: { month: OCTOBER, objects: [{ id: 'october task' }] }
    })
  })

  test('drops a failure for a month the user already left', async () => {
    const { gateway, store, loadEventsMonth } = setup({ sources: [TASKS] })
    const september = deferred<EventsGatewayResult<EventsObjectRef[]>>()
    gateway.listObjects.mockReturnValueOnce(september.promise)

    const leaving = loadEventsMonth.execute(SEPTEMBER)
    await loadEventsMonth.execute(OCTOBER)
    september.resolve(unauthorized)
    await leaving

    expect(store.get()).toMatchObject({ phase: 'loaded', last: { month: OCTOBER } })
  })

  test('drops the result of a load a reload of the same month replaced', async () => {
    const { gateway, store, loadEventsMonth } = setup({ sources: [TASKS] })
    const first = deferred<EventsGatewayResult<EventsObjectRef[]>>()
    gateway.listObjects.mockReturnValueOnce(first.promise)

    const stale = loadEventsMonth.execute(SEPTEMBER)
    await loadEventsMonth.execute(SEPTEMBER)
    first.resolve(ok([ref('from before the selection changed', Date.UTC(2026, 8, 2, 8))]))
    await stale

    expect(store.get()).toMatchObject({ phase: 'loaded', last: { objects: [] } })
  })

  test('drops a result that lands after a reset', async () => {
    const { gateway, store, loadEventsMonth, reset } = setup({ sources: [TASKS] })
    const answer = deferred<EventsGatewayResult<EventsObjectRef[]>>()
    gateway.listObjects.mockReturnValueOnce(answer.promise)

    const running = loadEventsMonth.execute(SEPTEMBER)
    reset.execute()
    answer.resolve(ok([ref('task', Date.UTC(2026, 8, 2, 8))]))
    await running

    expect(store.get()).toEqual({ phase: 'idle' })
  })
})

describe('ResetEventsMonth', () => {
  test('forgets the loaded month', async () => {
    const { store, loadEventsMonth, reset } = setup()
    await loadEventsMonth.execute(SEPTEMBER)
    reset.execute()
    expect(store.get()).toEqual({ phase: 'idle' })
  })

  test('notifies no one when already idle', () => {
    const { store, reset } = setup()
    const listener = vi.fn()
    store.subscribe(listener)
    reset.execute()
    expect(listener).not.toHaveBeenCalled()
  })

  test('a reload after a reset starts from the current month again', async () => {
    const { store, loadEventsMonth, reset } = setup()
    await loadEventsMonth.execute(DECEMBER)
    reset.execute()
    await loadEventsMonth.execute()
    expect(store.get()).toMatchObject({ last: { month: SEPTEMBER } })
  })
})

test('a timed object at the start of an hour is not all-day', async () => {
  const { store, loadEventsMonth } = setup({
    sources: [TASKS],
    refs: { task: [ref('standup', Date.UTC(2026, 8, 3) + 9 * HOUR_MS)] }
  })
  await loadEventsMonth.execute(SEPTEMBER)
  expect(store.get()).toMatchObject({ last: { objects: [{ allDay: false }] } })
})
