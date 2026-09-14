import { describe, expect, test } from 'vitest'
import type { EventsDatedObject, EventsMonthResult } from '@anytype-calendar/events/domain'
import type { EventsSnapshot } from '@shared/ipc'
import { eventsFor, localDate, localTime, monthOf, monthStatusFor, shownMonthFor } from './events'

// Built from local wall times, so these hold in whatever zone the tests run in.
const local = (month: number, day: number, hours = 0, minutes = 0): number =>
  new Date(2026, month, day, hours, minutes).getTime()

const SEPTEMBER = { year: 2026, month: 8 }
const OCTOBER = { year: 2026, month: 9 }
const NOW = local(8, 14, 9, 30)

const object = (overrides: Partial<EventsDatedObject>): EventsDatedObject => ({
  id: 'obj_1',
  spaceId: 'sp_1',
  typeKey: 'task',
  title: 'Ship it',
  start: local(8, 3),
  end: null,
  allDay: true,
  ...overrides
})

const result = (objects: EventsDatedObject[], month = SEPTEMBER): EventsMonthResult => ({
  month,
  objects,
  loadedAt: local(8, 14, 9, 28)
})

const loaded = (objects: EventsDatedObject[], month = SEPTEMBER): EventsSnapshot => ({
  phase: 'loaded',
  last: result(objects, month)
})

describe('shownMonthFor', () => {
  test("is the current month before main's first load", () => {
    expect(shownMonthFor({ phase: 'idle' }, NOW)).toEqual(SEPTEMBER)
  })

  test('is the month main is loading, even while it holds another', () => {
    expect(shownMonthFor({ phase: 'loading', month: OCTOBER, last: result([]) }, NOW)).toEqual(OCTOBER)
  })

  test('is the month main loaded', () => {
    expect(shownMonthFor(loaded([], OCTOBER), NOW)).toEqual(OCTOBER)
  })
})

describe('monthOf', () => {
  test('rolls into the next year at midnight on New Year', () => {
    expect(monthOf(new Date(2027, 0, 1).getTime())).toEqual({ year: 2027, month: 0 })
    expect(monthOf(new Date(2027, 0, 1).getTime() - 1)).toEqual({ year: 2026, month: 11 })
  })
})

describe('eventsFor', () => {
  test('is null before the month is read', () => {
    expect(eventsFor({ phase: 'idle' }, SEPTEMBER)).toBeNull()
    expect(eventsFor({ phase: 'loading', month: SEPTEMBER }, SEPTEMBER)).toBeNull()
  })

  test("is null while another month's result is all there is", () => {
    const loading: EventsSnapshot = { phase: 'loading', month: OCTOBER, last: result([object({})]) }
    expect(eventsFor(loading, OCTOBER)).toBeNull()
  })

  test('keeps the objects on screen while the month is read again, or fails to be', () => {
    const last = result([object({})])
    expect(eventsFor({ phase: 'loading', month: SEPTEMBER, last }, SEPTEMBER)).toHaveLength(1)
    expect(
      eventsFor({ phase: 'failed', month: SEPTEMBER, failure: 'unreachable', at: NOW, last }, SEPTEMBER)
    ).toHaveLength(1)
  })

  test('is empty for a month read with nothing in it', () => {
    expect(eventsFor(loaded([]), SEPTEMBER)).toEqual([])
  })

  test('draws an all-day object on its local date, keyed to its type as lib/schema keys it', () => {
    expect(eventsFor(loaded([object({})]), SEPTEMBER)).toEqual([
      { id: 'obj_1', title: 'Ship it', type: 'sp_1:task', space: 'sp_1', date: '2026-09-03', allDay: true }
    ])
  })

  test('gives a timed object its local time', () => {
    const [event] = eventsFor(loaded([object({ start: local(8, 3, 14, 5), allDay: false })]), SEPTEMBER) ?? []
    expect(event).toMatchObject({ date: '2026-09-03', time: '14:05', allDay: false })
    expect(event).not.toHaveProperty('until')
  })

  test('ends an all-day range on the date of its end, with no time', () => {
    const [event] =
      eventsFor(loaded([object({ start: local(7, 28), end: local(8, 2) })]), SEPTEMBER) ?? []
    expect(event).toEqual(expect.objectContaining({ date: '2026-08-28', until: '2026-09-02' }))
    expect(event).not.toHaveProperty('time')
    expect(event).not.toHaveProperty('end')
  })

  test('ends a timed range at its end time', () => {
    const [event] =
      eventsFor(
        loaded([object({ start: local(8, 9, 9, 30), end: local(8, 9, 10, 15), allDay: false })]),
        SEPTEMBER
      ) ?? []
    expect(event).toMatchObject({ date: '2026-09-09', time: '09:30', until: '2026-09-09', end: '10:15' })
  })

  test('titles an object with no title as Anytype does', () => {
    const [event] = eventsFor(loaded([object({ title: '' })]), SEPTEMBER) ?? []
    expect(event?.title).toBe('Untitled')
  })
})

describe('monthStatusFor', () => {
  test('is syncing while the month is read', () => {
    expect(monthStatusFor({ phase: 'idle' }, SEPTEMBER, NOW)).toEqual({ state: 'syncing', hasResult: false })
    expect(monthStatusFor({ phase: 'loading', month: SEPTEMBER, last: result([]) }, SEPTEMBER, NOW)).toEqual({
      state: 'syncing',
      hasResult: true
    })
  })

  test('says how long ago the month was read', () => {
    expect(monthStatusFor(loaded([]), SEPTEMBER, NOW)).toEqual({
      state: 'synced',
      detail: '2 min ago',
      hasResult: true
    })
  })

  test('says why a read failed', () => {
    const failed = (failure: 'unauthorized' | 'unreachable'): EventsSnapshot => ({
      phase: 'failed',
      month: SEPTEMBER,
      failure,
      at: NOW
    })
    expect(monthStatusFor(failed('unauthorized'), SEPTEMBER, NOW)).toEqual({
      state: 'error',
      detail: 'Key not accepted',
      hasResult: false
    })
    expect(monthStatusFor(failed('unreachable'), SEPTEMBER, NOW)).toMatchObject({
      detail: 'Is Anytype running?'
    })
  })
})

describe('localDate and localTime', () => {
  test('zero-pad', () => {
    expect(localDate(local(0, 5, 7, 3))).toBe('2026-01-05')
    expect(localTime(local(0, 5, 7, 3))).toBe('07:03')
  })
})
