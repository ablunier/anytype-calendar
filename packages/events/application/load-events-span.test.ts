import { describe, expect, test, vi } from 'vitest'
import type {
  EventsGateway,
  EventsGatewayResult,
  EventsSpanLoad,
  EventsObjectRef,
  EventsSource,
  EventsTimeZone
} from '../domain'
import { EventsSpanStore } from './events-span-store'
import { LoadEventsSpan } from './load-events-span'
import { ResetEventsSpan } from './reset-events-span'

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

const SEPTEMBER = { kind: 'month', year: 2026, month: 8 } as const
const OCTOBER = { kind: 'month', year: 2026, month: 9 } as const
const DECEMBER = { kind: 'month', year: 2026, month: 11 } as const

const TASKS: EventsSource = {
  spaceId: 'sp_1',
  typeKey: 'task',
  from: 'due_date',
  to: null,
  includesTime: true
}
const PROJECTS: EventsSource = {
  spaceId: 'sp_2',
  typeKey: 'project',
  from: 'start_date',
  to: 'due_date',
  includesTime: false
}

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
  const store = new EventsSpanStore()
  const loadEventsSpan = new LoadEventsSpan({
    gateway,
    apiKeys: { current: async () => apiKey },
    sources: { current: () => sources },
    zone: UTC,
    store,
    now: () => NOW
  })
  return { gateway, store, loadEventsSpan, reset: new ResetEventsSpan(store) }
}

test("asks each source for the month's window and keeps the objects that overlap it, in order", async () => {
  const { gateway, store, loadEventsSpan } = setup({
    refs: {
      task: [ref('late task', Date.UTC(2026, 8, 20, 15)), ref('august task', Date.UTC(2026, 7, 10))],
      project: [
        ref('spans in', Date.UTC(2026, 7, 28), Date.UTC(2026, 8, 2)),
        ref('ended before', Date.UTC(2026, 7, 1), Date.UTC(2026, 7, 10)),
        ref('runs out', Date.UTC(2026, 8, 29), Date.UTC(2026, 9, 3))
      ]
    }
  })

  await loadEventsSpan.execute(SEPTEMBER)

  // A month is read with a week of slack either side, for the grid rows it shares with the
  // adjacent months.
  const window = { start: Date.UTC(2026, 7, 25), end: Date.UTC(2026, 9, 8) - 1 }
  expect(gateway.listObjects).toHaveBeenCalledWith(API_KEY, TASKS, window)
  expect(gateway.listObjects).toHaveBeenCalledWith(API_KEY, PROJECTS, window)
  expect(store.get()).toEqual({
    phase: 'loaded',
    last: {
      span: SEPTEMBER,
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

test('asks for December across the turn of the year', async () => {
  const { gateway, loadEventsSpan } = setup({ sources: [TASKS] })
  await loadEventsSpan.execute(DECEMBER)
  expect(gateway.listObjects).toHaveBeenCalledWith(API_KEY, TASKS, {
    start: Date.UTC(2026, 10, 24),
    end: Date.UTC(2027, 0, 8) - 1
  })
})

test('asks for a week exactly, so one straddling a month is read whole', async () => {
  const { gateway, loadEventsSpan } = setup({ sources: [TASKS] })
  await loadEventsSpan.execute({ kind: 'week', start: { year: 2026, month: 8, day: 28 } })
  expect(gateway.listObjects).toHaveBeenCalledWith(API_KEY, TASKS, {
    start: Date.UTC(2026, 8, 28),
    end: Date.UTC(2026, 9, 5) - 1
  })
})

test('asks for a day exactly', async () => {
  const { gateway, loadEventsSpan } = setup({ sources: [TASKS] })
  await loadEventsSpan.execute({ kind: 'day', start: { year: 2026, month: 8, day: 14 } })
  expect(gateway.listObjects).toHaveBeenCalledWith(API_KEY, TASKS, {
    start: Date.UTC(2026, 8, 14),
    end: Date.UTC(2026, 8, 15) - 1
  })
})

test('is loaded and empty with nothing selected, asking Anytype nothing', async () => {
  const { gateway, store, loadEventsSpan } = setup({ sources: [] })
  await loadEventsSpan.execute(SEPTEMBER)
  expect(store.get()).toEqual({ phase: 'loaded', last: { span: SEPTEMBER, objects: [], loadedAt: NOW } })
  expect(gateway.listObjects).not.toHaveBeenCalled()
})

test('is loading while Anytype is being read', async () => {
  const { gateway, store, loadEventsSpan } = setup({ sources: [TASKS] })
  const answer = deferred<EventsGatewayResult<EventsObjectRef[]>>()
  gateway.listObjects.mockReturnValueOnce(answer.promise)

  const running = loadEventsSpan.execute(SEPTEMBER)
  await Promise.resolve()
  expect(store.get()).toEqual({ phase: 'loading', span: SEPTEMBER })

  answer.resolve(ok([]))
  await running
  expect(store.get()).toMatchObject({ phase: 'loaded' })
})

describe('without a span', () => {
  test('loads the current month before any', async () => {
    const { store, loadEventsSpan } = setup()
    await loadEventsSpan.execute()
    expect(store.get()).toMatchObject({ phase: 'loaded', last: { span: SEPTEMBER } })
  })

  test('opens on the span the composition root supplies, e.g. the saved view', async () => {
    const week = { kind: 'week', start: { year: 2026, month: 8, day: 14 } } as const
    const store = new EventsSpanStore()
    const loadEventsSpan = new LoadEventsSpan({
      gateway: setup().gateway,
      apiKeys: { current: async () => API_KEY },
      sources: { current: () => [TASKS] },
      zone: UTC,
      store,
      defaultSpan: () => week,
      now: () => NOW
    })
    await loadEventsSpan.execute()
    expect(store.get()).toMatchObject({ phase: 'loaded', last: { span: week } })
  })

  test('reads the span on screen again', async () => {
    const { gateway, store, loadEventsSpan } = setup({ sources: [TASKS] })
    await loadEventsSpan.execute(DECEMBER)
    await loadEventsSpan.execute()
    expect(gateway.listObjects).toHaveBeenCalledTimes(2)
    expect(store.get()).toMatchObject({ phase: 'loaded', last: { span: DECEMBER } })
  })

  test('tries a failed span again', async () => {
    const { gateway, store, loadEventsSpan } = setup({ sources: [TASKS] })
    gateway.listObjects.mockRejectedValueOnce(new TypeError('fetch failed'))
    await loadEventsSpan.execute(OCTOBER)
    await loadEventsSpan.execute()
    expect(store.get()).toMatchObject({ phase: 'loaded', last: { span: OCTOBER } })
  })
})

test('reads the selection as it is when the load starts', async () => {
  let sources = [TASKS]
  const { gateway } = setup()
  const store = new EventsSpanStore()
  const loadEventsSpan = new LoadEventsSpan({
    gateway,
    apiKeys: { current: async () => API_KEY },
    sources: { current: () => sources },
    zone: UTC,
    store,
    now: () => NOW
  })
  await loadEventsSpan.execute(SEPTEMBER)
  sources = [PROJECTS]
  await loadEventsSpan.execute()
  expect(gateway.listObjects.mock.calls.map(([, source]) => source.typeKey)).toEqual(['task', 'project'])
})

test('fails as unauthorized without a stored key, asking Anytype nothing', async () => {
  const { gateway, store, loadEventsSpan } = setup({ apiKey: null })
  await loadEventsSpan.execute(SEPTEMBER)
  expect(store.get()).toEqual({ phase: 'failed', span: SEPTEMBER, failure: 'unauthorized', at: NOW })
  expect(gateway.listObjects).not.toHaveBeenCalled()
})

test('fails as unauthorized when a source is refused', async () => {
  const { gateway, store, loadEventsSpan } = setup()
  gateway.listObjects.mockResolvedValueOnce(unauthorized)
  await loadEventsSpan.execute(SEPTEMBER)
  expect(store.get()).toMatchObject({ phase: 'failed', failure: 'unauthorized' })
})

test('fails as unreachable when a request rejects', async () => {
  const { gateway, store, loadEventsSpan } = setup()
  gateway.listObjects.mockRejectedValueOnce(new TypeError('fetch failed'))
  await loadEventsSpan.execute(SEPTEMBER)
  expect(store.get()).toEqual({ phase: 'failed', span: SEPTEMBER, failure: 'unreachable', at: NOW })
})

test('keeps the last result through a failed reload', async () => {
  const { gateway, store, loadEventsSpan } = setup({
    sources: [TASKS],
    refs: { task: [ref('task', Date.UTC(2026, 8, 3, 10))] }
  })
  await loadEventsSpan.execute(SEPTEMBER)
  const { last } = store.get() as Extract<EventsSpanLoad, { phase: 'loaded' }>

  gateway.listObjects.mockRejectedValueOnce(new TypeError('fetch failed'))
  await loadEventsSpan.execute()

  expect(store.get()).toEqual({ phase: 'failed', span: SEPTEMBER, failure: 'unreachable', at: NOW, last })
})

describe('racing', () => {
  test('drops the result for a month the user already left', async () => {
    const { gateway, store, loadEventsSpan } = setup({
      sources: [TASKS],
      refs: { task: [ref('october task', Date.UTC(2026, 9, 5, 12))] }
    })
    const september = deferred<EventsGatewayResult<EventsObjectRef[]>>()
    gateway.listObjects.mockReturnValueOnce(september.promise)

    const leaving = loadEventsSpan.execute(SEPTEMBER)
    await loadEventsSpan.execute(OCTOBER)
    september.resolve(ok([ref('september task', Date.UTC(2026, 8, 5, 12))]))
    await leaving

    expect(store.get()).toMatchObject({
      phase: 'loaded',
      last: { span: OCTOBER, objects: [{ id: 'october task' }] }
    })
  })

  test('drops a failure for a month the user already left', async () => {
    const { gateway, store, loadEventsSpan } = setup({ sources: [TASKS] })
    const september = deferred<EventsGatewayResult<EventsObjectRef[]>>()
    gateway.listObjects.mockReturnValueOnce(september.promise)

    const leaving = loadEventsSpan.execute(SEPTEMBER)
    await loadEventsSpan.execute(OCTOBER)
    september.resolve(unauthorized)
    await leaving

    expect(store.get()).toMatchObject({ phase: 'loaded', last: { span: OCTOBER } })
  })

  test('drops the result of a load a reload of the same month replaced', async () => {
    const { gateway, store, loadEventsSpan } = setup({ sources: [TASKS] })
    const first = deferred<EventsGatewayResult<EventsObjectRef[]>>()
    gateway.listObjects.mockReturnValueOnce(first.promise)

    const stale = loadEventsSpan.execute(SEPTEMBER)
    await loadEventsSpan.execute(SEPTEMBER)
    first.resolve(ok([ref('from before the selection changed', Date.UTC(2026, 8, 2, 8))]))
    await stale

    expect(store.get()).toMatchObject({ phase: 'loaded', last: { objects: [] } })
  })

  test('drops a result that lands after a reset', async () => {
    const { gateway, store, loadEventsSpan, reset } = setup({ sources: [TASKS] })
    const answer = deferred<EventsGatewayResult<EventsObjectRef[]>>()
    gateway.listObjects.mockReturnValueOnce(answer.promise)

    const running = loadEventsSpan.execute(SEPTEMBER)
    reset.execute()
    answer.resolve(ok([ref('task', Date.UTC(2026, 8, 2, 8))]))
    await running

    expect(store.get()).toEqual({ phase: 'idle' })
  })
})

describe('ResetEventsSpan', () => {
  test('forgets the loaded month', async () => {
    const { store, loadEventsSpan, reset } = setup()
    await loadEventsSpan.execute(SEPTEMBER)
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
    const { store, loadEventsSpan, reset } = setup()
    await loadEventsSpan.execute(DECEMBER)
    reset.execute()
    await loadEventsSpan.execute()
    expect(store.get()).toMatchObject({ last: { span: SEPTEMBER } })
  })
})

test('an object of a timed source is not all-day, whatever the instant', async () => {
  const { store, loadEventsSpan } = setup({
    sources: [TASKS],
    refs: { task: [ref('standup', Date.UTC(2026, 8, 3))] }
  })
  await loadEventsSpan.execute(SEPTEMBER)
  expect(store.get()).toMatchObject({ last: { objects: [{ allDay: false }] } })
})

test('an object of an all-day source is all-day, whatever the instant', async () => {
  const { store, loadEventsSpan } = setup({
    sources: [PROJECTS],
    refs: { project: [ref('launch', Date.UTC(2026, 8, 3) + 9 * HOUR_MS)] }
  })
  await loadEventsSpan.execute(SEPTEMBER)
  expect(store.get()).toMatchObject({ last: { objects: [{ allDay: true }] } })
})
