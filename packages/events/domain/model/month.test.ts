import { describe, expect, test } from 'vitest'
import type { EventsTimeZone } from '../gateways/time-zone'
import { sameEventsMonth, shiftEventsMonth, toEventsMonth } from './month'
import { eventsMonthWindow } from './window'

const UTC: EventsTimeZone = {
  startOfDay: ({ year, month, day }) => Date.UTC(year, month, day),
  dayOf: (instant) => {
    const date = new Date(instant)
    return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() }
  }
}

const HOUR_MS = 3_600_000

describe('shiftEventsMonth', () => {
  test('moves within a year', () => {
    expect(shiftEventsMonth({ year: 2026, month: 2 }, 1)).toEqual({ year: 2026, month: 3 })
    expect(shiftEventsMonth({ year: 2026, month: 2 }, -2)).toEqual({ year: 2026, month: 0 })
  })

  test('rolls over into the next year', () => {
    expect(shiftEventsMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 })
    expect(shiftEventsMonth({ year: 2026, month: 8 }, 13)).toEqual({ year: 2027, month: 9 })
  })

  test('rolls back into the previous year', () => {
    expect(shiftEventsMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 })
    expect(shiftEventsMonth({ year: 2026, month: 1 }, -26)).toEqual({ year: 2023, month: 11 })
  })

  test('stays put for no shift', () => {
    expect(shiftEventsMonth({ year: 2026, month: 5 }, 0)).toEqual({ year: 2026, month: 5 })
  })
})

describe('sameEventsMonth', () => {
  test('compares year and month', () => {
    expect(sameEventsMonth({ year: 2026, month: 1 }, { year: 2026, month: 1 })).toBe(true)
    expect(sameEventsMonth({ year: 2026, month: 1 }, { year: 2027, month: 1 })).toBe(false)
    expect(sameEventsMonth({ year: 2026, month: 1 }, { year: 2026, month: 2 })).toBe(false)
  })
})

describe('eventsMonthWindow', () => {
  test('runs from the first instant of the month to the last before the next', () => {
    expect(eventsMonthWindow({ year: 2026, month: 1 }, UTC)).toEqual({
      start: Date.UTC(2026, 1, 1),
      end: Date.UTC(2026, 2, 1) - 1
    })
  })

  test('ends December at the start of the next year', () => {
    expect(eventsMonthWindow({ year: 2026, month: 11 }, UTC)).toEqual({
      start: Date.UTC(2026, 11, 1),
      end: Date.UTC(2027, 0, 1) - 1
    })
  })

  test("follows the zone's days, e.g. a month whose clocks change", () => {
    // A zone two hours ahead of UTC until 25 October, one hour ahead from then.
    const zone: EventsTimeZone = {
      startOfDay: ({ year, month, day }) =>
        Date.UTC(year, month, day) - (Date.UTC(year, month, day) < Date.UTC(2026, 9, 25) ? 2 : 1) * HOUR_MS,
      dayOf: () => {
        throw new Error('unused')
      }
    }
    expect(eventsMonthWindow({ year: 2026, month: 9 }, zone)).toEqual({
      start: Date.UTC(2026, 9, 1) - 2 * HOUR_MS,
      end: Date.UTC(2026, 10, 1) - HOUR_MS - 1
    })
  })
})

describe('toEventsMonth', () => {
  test('accepts a month', () => {
    expect(toEventsMonth({ year: 2026, month: 0 })).toEqual({ year: 2026, month: 0 })
    expect(toEventsMonth({ year: 9999, month: 11 })).toEqual({ year: 9999, month: 11 })
  })

  test('keeps only the fields it knows', () => {
    expect(toEventsMonth({ year: 2026, month: 3, day: 9 })).toEqual({ year: 2026, month: 3 })
  })

  test.each([
    ['not an object', '2026-03'],
    ['null', null],
    ['no year', { month: 3 }],
    ['a string year', { year: '2026', month: 3 }],
    ['a fractional month', { year: 2026, month: 2.5 }],
    ['month 12', { year: 2026, month: 12 }],
    ['a negative month', { year: 2026, month: -1 }],
    ['year 0', { year: 0, month: 0 }],
    ['a five-digit year', { year: 10_000, month: 0 }],
    ['an infinite year', { year: Infinity, month: 0 }]
  ])('rejects %s', (_, value) => {
    expect(toEventsMonth(value)).toBeNull()
  })
})
