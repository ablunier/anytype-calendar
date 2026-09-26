import { describe, expect, test } from 'vitest'
import type { EventsDatedObject, EventsSpanResult } from '@anytype-calendar/events/domain'
import type { EventsSnapshot } from '@shared/ipc'
import {
  anchorOf,
  eventsFor,
  localDate,
  localTime,
  monthOf,
  shiftSpan,
  shownSpanFor,
  spanFor,
  spanStatusFor,
  switchDateFor
} from './events'

// Built from local wall times, so these hold in whatever zone the tests run in.
const local = (month: number, day: number, hours = 0, minutes = 0): number =>
  new Date(2026, month, day, hours, minutes).getTime()

const SEPTEMBER = { kind: 'month', year: 2026, month: 8 } as const
const OCTOBER = { kind: 'month', year: 2026, month: 9 } as const
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

const result = (objects: EventsDatedObject[], span: EventsSpanResult['span'] = SEPTEMBER): EventsSpanResult => ({
  span,
  objects,
  loadedAt: local(8, 14, 9, 28)
})

const loaded = (
  objects: EventsDatedObject[],
  span: EventsSpanResult['span'] = SEPTEMBER
): EventsSnapshot => ({
  phase: 'loaded',
  last: result(objects, span)
})

describe('shownSpanFor', () => {
  test("is the saved view's span around today before main's first load", () => {
    expect(shownSpanFor({ phase: 'idle' }, 'month', NOW)).toEqual(SEPTEMBER)
    expect(shownSpanFor({ phase: 'idle' }, 'day', NOW)).toEqual({
      kind: 'day',
      start: { year: 2026, month: 8, day: 14 }
    })
  })

  test('is the span main is loading, even while it holds another', () => {
    expect(
      shownSpanFor({ phase: 'loading', span: OCTOBER, last: result([]) }, 'month', NOW)
    ).toEqual(OCTOBER)
  })

  test('is the span main loaded', () => {
    expect(shownSpanFor(loaded([], OCTOBER), 'month', NOW)).toEqual(OCTOBER)
  })
})

describe('spanFor and anchorOf', () => {
  test('round-trip a month through its first day', () => {
    expect(spanFor('month', '2026-09-14', 0)).toEqual(SEPTEMBER)
    expect(anchorOf(SEPTEMBER)).toBe('2026-09-01')
  })

  test('anchor a day on itself', () => {
    const span = spanFor('day', '2026-09-14', 0)
    expect(span).toEqual({ kind: 'day', start: { year: 2026, month: 8, day: 14 } })
    expect(anchorOf(span)).toBe('2026-09-14')
  })

  test("anchor a week on the user's own first day of the week", () => {
    // 2026-09-23 is a Wednesday.
    expect(anchorOf(spanFor('week', '2026-09-23', 0))).toBe('2026-09-21')
    expect(anchorOf(spanFor('week', '2026-09-23', 6))).toBe('2026-09-20')
  })
})

describe('shiftSpan', () => {
  test('moves a month by months, rolling over the year', () => {
    expect(shiftSpan(SEPTEMBER, 1)).toEqual(OCTOBER)
    expect(shiftSpan({ kind: 'month', year: 2026, month: 11 }, 1)).toEqual({
      kind: 'month',
      year: 2027,
      month: 0
    })
    expect(shiftSpan({ kind: 'month', year: 2026, month: 0 }, -1)).toEqual({
      kind: 'month',
      year: 2025,
      month: 11
    })
  })

  test('moves a week by seven days, across a month and a year', () => {
    expect(anchorOf(shiftSpan(spanFor('week', '2026-09-28', 0), 1))).toBe('2026-10-05')
    expect(anchorOf(shiftSpan(spanFor('week', '2026-12-28', 0), 1))).toBe('2027-01-04')
  })

  test('moves a day by one day', () => {
    expect(anchorOf(shiftSpan(spanFor('day', '2026-09-30', 0), 1))).toBe('2026-10-01')
    expect(anchorOf(shiftSpan(spanFor('day', '2026-01-01', 0), -1))).toBe('2025-12-31')
  })
})

describe('monthOf', () => {
  test('rolls into the next year at midnight on New Year', () => {
    expect(monthOf(new Date(2027, 0, 1).getTime())).toEqual({ year: 2027, month: 0 })
    expect(monthOf(new Date(2027, 0, 1).getTime() - 1)).toEqual({ year: 2026, month: 11 })
  })
})

describe('eventsFor', () => {
  test('is null before the span is read', () => {
    expect(eventsFor({ phase: 'idle' }, SEPTEMBER)).toBeNull()
    expect(eventsFor({ phase: 'loading', span: SEPTEMBER }, SEPTEMBER)).toBeNull()
  })

  test("is null while another span's result is all there is", () => {
    const loading: EventsSnapshot = { phase: 'loading', span: OCTOBER, last: result([object({})]) }
    expect(eventsFor(loading, OCTOBER)).toBeNull()
  })

  test('tells a week from a month that starts on the same day', () => {
    const week = spanFor('week', '2026-09-01', 0)
    expect(eventsFor(loaded([object({})], week), SEPTEMBER)).toBeNull()
  })

  test('keeps the objects on screen while the span is read again, or fails to be', () => {
    const last = result([object({})])
    expect(eventsFor({ phase: 'loading', span: SEPTEMBER, last }, SEPTEMBER)).toHaveLength(1)
    expect(
      eventsFor({ phase: 'failed', span: SEPTEMBER, failure: 'unreachable', at: NOW, last }, SEPTEMBER)
    ).toHaveLength(1)
  })

  test('is empty for a span read with nothing in it', () => {
    expect(eventsFor(loaded([]), SEPTEMBER)).toEqual([])
  })

  test('draws an all-day object on its local date, keyed to its type as lib/schema keys it', () => {
    expect(eventsFor(loaded([object({})]), SEPTEMBER)).toEqual([
      { id: 'obj_1', title: 'Ship it', type: 'sp_1:task', space: 'sp_1', date: '2026-09-03', allDay: true }
    ])
  })

  test('carries whether it is done, its location, and the hue of the option it is coloured by', () => {
    const [event] =
      eventsFor(loaded([object({ done: true, location: 'Clinic', colour: 'red' })]), SEPTEMBER) ?? []
    expect(event).toMatchObject({ done: true, location: 'Clinic', category: 'clay' })
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

  test('keeps an empty title as-is; the render sites fall back to a translated "Untitled"', () => {
    const [event] = eventsFor(loaded([object({ title: '' })]), SEPTEMBER) ?? []
    expect(event?.title).toBe('')
  })
})

describe('spanStatusFor', () => {
  test('is syncing while the span is read', () => {
    expect(spanStatusFor({ phase: 'idle' }, SEPTEMBER, NOW)).toEqual({ state: 'syncing', hasResult: false })
    expect(spanStatusFor({ phase: 'loading', span: SEPTEMBER, last: result([]) }, SEPTEMBER, NOW)).toEqual({
      state: 'syncing',
      hasResult: true
    })
  })

  test('says how long ago the span was read', () => {
    expect(spanStatusFor(loaded([]), SEPTEMBER, NOW)).toEqual({
      state: 'synced',
      detail: { kind: 'elapsed', elapsed: { key: 'minutesAgo', count: 2 } },
      hasResult: true
    })
  })

  test('says why a read failed', () => {
    const failed = (failure: 'unauthorized' | 'unreachable'): EventsSnapshot => ({
      phase: 'failed',
      span: SEPTEMBER,
      failure,
      at: NOW
    })
    expect(spanStatusFor(failed('unauthorized'), SEPTEMBER, NOW)).toEqual({
      state: 'error',
      detail: { kind: 'unauthorized' },
      hasResult: false
    })
    expect(spanStatusFor(failed('unreachable'), SEPTEMBER, NOW)).toMatchObject({
      detail: { kind: 'unreachable' }
    })
  })
})

describe('localDate and localTime', () => {
  test('zero-pad', () => {
    expect(localDate(local(0, 5, 7, 3))).toBe('2026-01-05')
    expect(localTime(local(0, 5, 7, 3))).toBe('07:03')
  })
})

describe('switchDateFor', () => {
  const TODAY = '2026-09-23'

  test('stays on today when the span covers it', () => {
    expect(switchDateFor(SEPTEMBER, TODAY)).toBe(TODAY)
    expect(switchDateFor(spanFor('week', TODAY, 0), TODAY)).toBe(TODAY)
    expect(switchDateFor(spanFor('day', TODAY, 0), TODAY)).toBe(TODAY)
  })

  test("keeps the reader where they were when the span is elsewhere", () => {
    expect(switchDateFor(OCTOBER, TODAY)).toBe('2026-10-01')
    expect(switchDateFor(spanFor('week', '2026-03-10', 0), TODAY)).toBe('2026-03-09')
    expect(switchDateFor(spanFor('day', '2026-03-10', 0), TODAY)).toBe('2026-03-10')
  })

  test('counts the last day of a week as covered', () => {
    // The week of Monday 21 September ends on Sunday the 27th.
    expect(switchDateFor(spanFor('week', '2026-09-21', 0), '2026-09-27')).toBe('2026-09-27')
    expect(switchDateFor(spanFor('week', '2026-09-21', 0), '2026-09-28')).toBe('2026-09-21')
  })
})
