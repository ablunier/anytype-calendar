import { describe, expect, test, vi } from 'vitest'
import type {
  EventsGateway,
  EventsObjectRef,
  EventsSource,
  EventsSpanLoad,
  EventsTimeZone,
  EventsWriteResult,
  EventsWriter
} from '../domain'
import {
  CompleteEventsObject,
  CreateEventsObject,
  RescheduleEventsObject
} from './edit-events-object'
import { EventsSpanStore } from './events-span-store'
import { LoadEventsSpan } from './load-events-span'

const API_KEY = 'ak_secret'
const NOW = Date.UTC(2026, 8, 14, 9, 30)

const UTC: EventsTimeZone = {
  startOfDay: ({ year, month, day }) => Date.UTC(year, month, day),
  at: ({ year, month, day }, minute) => Date.UTC(year, month, day, 0, minute),
  dayOf: (instant) => {
    const date = new Date(instant)
    return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() }
  }
}

const SEPTEMBER = { kind: 'month', year: 2026, month: 8 } as const

const MEETINGS: EventsSource = {
  kind: 'type',
  spaceId: 'sp_1',
  typeKey: 'meeting',
  from: 'start_date',
  to: 'end_date',
  includesTime: true
}
const TASKS: EventsSource = {
  kind: 'type',
  spaceId: 'sp_1',
  typeKey: 'task',
  from: 'due_date',
  to: null,
  includesTime: false,
  done: 'done'
}
const OPEN_TASKS: EventsSource = { ...TASKS, kind: 'query', queryId: 'q_open', viewId: null }

const standup: EventsObjectRef = {
  id: 'obj_1',
  title: 'Standup',
  start: Date.UTC(2026, 8, 14, 9),
  end: Date.UTC(2026, 8, 14, 9, 30)
}
const invoice: EventsObjectRef = { id: 'obj_2', title: 'Invoice', start: Date.UTC(2026, 8, 20), end: null, done: false }

const OK: EventsWriteResult = { ok: true, value: null }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

async function setup({
  sources = [MEETINGS, TASKS] as EventsSource[],
  write = async (): Promise<EventsWriteResult<never> | EventsWriteResult> => OK
} = {}) {
  let refs: Record<string, EventsObjectRef[]> = { meeting: [standup], task: [invoice], q_open: [invoice] }
  const gateway = {
    listObjects: vi.fn<EventsGateway['listObjects']>(async (_key, source) => ({
      ok: true,
      value: refs[source.kind === 'type' ? source.typeKey : source.queryId] ?? []
    }))
  }
  const writer = {
    reschedule: vi.fn<EventsWriter['reschedule']>(write),
    create: vi.fn<EventsWriter['create']>(async () => {
      const result = await write()
      return result.ok ? { ok: true, value: { id: 'obj_new' } } : result
    }),
    setDone: vi.fn<EventsWriter['setDone']>(write)
  }
  const store = new EventsSpanStore()
  let apiKey: string | null = API_KEY
  const apiKeys = { current: async () => apiKey }
  const selection = { current: () => sources }
  const load = new LoadEventsSpan({ gateway, apiKeys, sources: selection, zone: UTC, store, now: () => NOW })
  await load.execute(SEPTEMBER)
  const deps = { writer, apiKeys, sources: selection, zone: UTC, store, load }
  return {
    gateway,
    writer,
    store,
    setRefs: (next: typeof refs) => {
      refs = next
    },
    forgetKey: () => {
      apiKey = null
    },
    reschedule: new RescheduleEventsObject(deps),
    create: new CreateEventsObject(deps),
    complete: new CompleteEventsObject(deps)
  }
}

const objectsIn = (state: EventsSpanLoad) =>
  state.phase === 'idle' ? [] : (state.last?.objects ?? []).map(({ id, start, end, done }) => ({ id, start, end, done }))

describe('rescheduling', () => {
  test("writes the object's new dates to the source's properties, keeping how long it lasts, then reads the span again", async () => {
    const { reschedule, writer, gateway } = await setup()
    gateway.listObjects.mockClear()

    await expect(
      reschedule.execute({
        spaceId: 'sp_1',
        id: 'obj_1',
        change: { kind: 'move', start: { day: { year: 2026, month: 8, day: 16 }, minute: 14 * 60 } }
      })
    ).resolves.toEqual({ ok: true })
    expect(writer.reschedule).toHaveBeenCalledWith(
      API_KEY,
      { spaceId: 'sp_1', id: 'obj_1' },
      { start_date: Date.UTC(2026, 8, 16, 14), end_date: Date.UTC(2026, 8, 16, 14, 30) }
    )
    expect(gateway.listObjects).toHaveBeenCalled()
  })

  test('draws the object where it was moved to while the write is in flight, until the span is read again', async () => {
    const pending = deferred<EventsWriteResult>()
    const { reschedule, store, setRefs } = await setup({ write: () => pending.promise })
    const moved = Date.UTC(2026, 8, 16, 14)

    const done = reschedule.execute({
      spaceId: 'sp_1',
      id: 'obj_1',
      change: { kind: 'move', start: { day: { year: 2026, month: 8, day: 16 }, minute: 14 * 60 } }
    })
    expect(objectsIn(store.shown())).toContainEqual(expect.objectContaining({ id: 'obj_1', start: moved }))
    // What the store was loaded with is left alone: the edit is only drawn over it.
    expect(objectsIn(store.get())).toContainEqual(expect.objectContaining({ id: 'obj_1', start: standup.start }))

    setRefs({ meeting: [{ ...standup, start: moved, end: moved + 30 * 60_000 }], task: [invoice] })
    pending.resolve(OK)
    await done
    expect(objectsIn(store.shown())).toContainEqual(expect.objectContaining({ id: 'obj_1', start: moved }))
    expect(store.shown()).toBe(store.get())
  })

  test('puts the object back, and says why, when Anytype refuses the write', async () => {
    const { reschedule, store, gateway } = await setup({
      write: async () => ({ ok: false, failure: 'rejected', message: 'not a date' })
    })
    gateway.listObjects.mockClear()

    await expect(
      reschedule.execute({
        spaceId: 'sp_1',
        id: 'obj_1',
        change: { kind: 'move', start: { day: { year: 2026, month: 8, day: 16 }, minute: 600 } }
      })
    ).resolves.toEqual({ ok: false, failure: 'rejected', message: 'not a date' })
    expect(objectsIn(store.shown())).toContainEqual(expect.objectContaining({ id: 'obj_1', start: standup.start }))
    expect(gateway.listObjects).not.toHaveBeenCalled()
  })

  test('reads a write that never answered as Anytype being unreachable', async () => {
    const { reschedule } = await setup({ write: async () => Promise.reject(new Error('ECONNREFUSED')) })
    await expect(
      reschedule.execute({
        spaceId: 'sp_1',
        id: 'obj_1',
        change: { kind: 'move', start: { day: { year: 2026, month: 8, day: 16 }, minute: 600 } }
      })
    ).resolves.toEqual({ ok: false, failure: 'unreachable' })
  })

  test('writes no To for an object that has none, and refuses to resize a source without one', async () => {
    const { reschedule, writer } = await setup()
    const day = { year: 2026, month: 8, day: 22 }

    await reschedule.execute({ spaceId: 'sp_1', id: 'obj_2', change: { kind: 'move', start: { day, minute: null } } })
    expect(writer.reschedule).toHaveBeenCalledWith(API_KEY, { spaceId: 'sp_1', id: 'obj_2' }, {
      due_date: Date.UTC(2026, 8, 22)
    })

    await expect(
      reschedule.execute({ spaceId: 'sp_1', id: 'obj_2', change: { kind: 'resize', end: { day, minute: null } } })
    ).resolves.toEqual({ ok: false, failure: 'invalid' })
  })

  test('refuses an object that is not on the span, or whose pick is no longer chosen', async () => {
    const change = { kind: 'move', start: { day: { year: 2026, month: 8, day: 16 }, minute: 600 } } as const
    const { reschedule, writer } = await setup()
    await expect(reschedule.execute({ spaceId: 'sp_1', id: 'obj_9', change })).resolves.toEqual({
      ok: false,
      failure: 'gone'
    })

    const unchosen = await setup({ sources: [MEETINGS, TASKS] })
    const sources = [TASKS]
    const narrowed = new RescheduleEventsObject({
      writer: unchosen.writer,
      apiKeys: { current: async () => API_KEY },
      sources: { current: () => sources },
      zone: UTC,
      store: unchosen.store,
      load: new LoadEventsSpan({
        gateway: unchosen.gateway,
        apiKeys: { current: async () => API_KEY },
        sources: { current: () => sources },
        zone: UTC,
        store: unchosen.store
      })
    })
    await expect(narrowed.execute({ spaceId: 'sp_1', id: 'obj_1', change })).resolves.toEqual({
      ok: false,
      failure: 'gone'
    })
    expect(writer.reschedule).not.toHaveBeenCalled()
  })

  test('reads a missing key as unauthorized, without asking Anytype', async () => {
    const { reschedule, writer, forgetKey } = await setup()
    forgetKey()
    await expect(
      reschedule.execute({
        spaceId: 'sp_1',
        id: 'obj_1',
        change: { kind: 'move', start: { day: { year: 2026, month: 8, day: 16 }, minute: 600 } }
      })
    ).resolves.toEqual({ ok: false, failure: 'unauthorized' })
    expect(writer.reschedule).not.toHaveBeenCalled()
  })
})

describe('creating', () => {
  test("creates an object of a chosen type at the slot, placed by the type's dates", async () => {
    const { create, writer } = await setup()

    await expect(
      create.execute({
        spaceId: 'sp_1',
        typeKey: 'meeting',
        name: 'Retro',
        at: { day: { year: 2026, month: 8, day: 18 }, minute: 16 * 60 }
      })
    ).resolves.toEqual({ ok: true })
    expect(writer.create).toHaveBeenCalledWith(API_KEY, {
      spaceId: 'sp_1',
      typeKey: 'meeting',
      name: 'Retro',
      dates: { start_date: Date.UTC(2026, 8, 18, 16), end_date: Date.UTC(2026, 8, 18, 17) }
    })
  })

  test('refuses a type that is not chosen, or is chosen only through a query', async () => {
    const { create, writer } = await setup({ sources: [MEETINGS, OPEN_TASKS] })
    const at = { day: { year: 2026, month: 8, day: 18 }, minute: null }

    await expect(create.execute({ spaceId: 'sp_1', typeKey: 'task', name: 'x', at })).resolves.toEqual({
      ok: false,
      failure: 'gone'
    })
    await expect(create.execute({ spaceId: 'sp_2', typeKey: 'meeting', name: 'x', at })).resolves.toEqual({
      ok: false,
      failure: 'gone'
    })
    expect(writer.create).not.toHaveBeenCalled()
  })
})

describe('completing', () => {
  test("ticks the source's Done checkbox, drawing the object done while Anytype is asked", async () => {
    const pending = deferred<EventsWriteResult>()
    const { complete, writer, store } = await setup({ write: () => pending.promise })

    const result = complete.execute({ spaceId: 'sp_1', id: 'obj_2', done: true })
    expect(objectsIn(store.shown())).toContainEqual(expect.objectContaining({ id: 'obj_2', done: true }))
    await vi.waitFor(() => expect(writer.setDone).toHaveBeenCalled())
    expect(writer.setDone).toHaveBeenCalledWith(API_KEY, { spaceId: 'sp_1', id: 'obj_2' }, 'done', true)

    pending.resolve({ ok: false, failure: 'not-granted' })
    await expect(result).resolves.toEqual({ ok: false, failure: 'not-granted' })
    expect(objectsIn(store.shown())).toContainEqual(expect.objectContaining({ id: 'obj_2', done: false }))
  })

  test('refuses an object whose source has no Done', async () => {
    const { complete, writer } = await setup()
    await expect(complete.execute({ spaceId: 'sp_1', id: 'obj_1', done: true })).resolves.toEqual({
      ok: false,
      failure: 'invalid'
    })
    expect(writer.setDone).not.toHaveBeenCalled()
  })
})
