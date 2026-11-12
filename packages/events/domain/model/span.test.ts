import { describe, expect, test } from 'vitest'
import type { EventsTimeZone } from '../gateways/time-zone'
import {
  DEFAULT_AGENDA_DAYS,
  type EventsSpan,
  eventsSpanLength,
  sameEventsSpan,
  toEventsAgendaDays,
  toEventsSpan,
} from './span'
import { eventsSpanWindow } from './window'

const UTC: EventsTimeZone = {
  startOfDay: ({ year, month, day }) => Date.UTC(year, month, day),
  at: ({ year, month, day }, minute) => Date.UTC(year, month, day, 0, minute),
  dayOf: (instant) => {
    const date = new Date(instant)
    return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() }
  },
}

const HOUR_MS = 3_600_000

describe('eventsSpanWindow', () => {
  test('reads a month with a week of slack on each side, for the grid padding', () => {
    expect(eventsSpanWindow({ kind: 'month', year: 2026, month: 1 }, UTC)).toEqual({
      start: Date.UTC(2026, 0, 25),
      end: Date.UTC(2026, 2, 8) - 1,
    })
  })

  test('carries a December month into the next year, slack and all', () => {
    expect(eventsSpanWindow({ kind: 'month', year: 2026, month: 11 }, UTC)).toEqual({
      start: Date.UTC(2026, 10, 24),
      end: Date.UTC(2027, 0, 8) - 1,
    })
  })

  test('runs a week from its first day to the last instant of its seventh', () => {
    const span: EventsSpan = { kind: 'week', start: { year: 2026, month: 8, day: 21 } }
    expect(eventsSpanWindow(span, UTC)).toEqual({
      start: Date.UTC(2026, 8, 21),
      end: Date.UTC(2026, 8, 28) - 1,
    })
  })

  test('runs a week straddling a month, and a year', () => {
    expect(eventsSpanWindow({ kind: 'week', start: { year: 2026, month: 8, day: 28 } }, UTC)).toEqual({
      start: Date.UTC(2026, 8, 28),
      end: Date.UTC(2026, 9, 5) - 1,
    })
    expect(eventsSpanWindow({ kind: 'week', start: { year: 2026, month: 11, day: 28 } }, UTC)).toEqual({
      start: Date.UTC(2026, 11, 28),
      end: Date.UTC(2027, 0, 4) - 1,
    })
  })

  test('runs a day from its first instant to its last', () => {
    expect(eventsSpanWindow({ kind: 'day', start: { year: 2026, month: 8, day: 30 } }, UTC)).toEqual({
      start: Date.UTC(2026, 8, 30),
      end: Date.UTC(2026, 9, 1) - 1,
    })
  })

  test.each([
    [7, Date.UTC(2026, 9, 28)],
    [14, Date.UTC(2026, 10, 4)],
    [28, Date.UTC(2026, 10, 18)],
  ] as const)('runs a %i-day agenda from its first day to the last instant of its last', (days, until) => {
    expect(eventsSpanWindow({ kind: 'agenda', start: { year: 2026, month: 9, day: 21 }, days }, UTC)).toEqual({
      start: Date.UTC(2026, 9, 21),
      end: until - 1,
    })
  })

  test('runs an agenda across the end of a month, and of a year', () => {
    expect(eventsSpanWindow({ kind: 'agenda', start: { year: 2026, month: 1, day: 20 }, days: 14 }, UTC)).toEqual({
      start: Date.UTC(2026, 1, 20),
      end: Date.UTC(2026, 2, 6) - 1,
    })
    expect(eventsSpanWindow({ kind: 'agenda', start: { year: 2026, month: 11, day: 25 }, days: 14 }, UTC)).toEqual({
      start: Date.UTC(2026, 11, 25),
      end: Date.UTC(2027, 0, 8) - 1,
    })
  })

  test("follows the zone's days, e.g. a week whose clocks change", () => {
    // A zone two hours ahead of UTC until 25 October, one hour ahead from then.
    const zone: EventsTimeZone = {
      startOfDay: ({ year, month, day }) =>
        Date.UTC(year, month, day) - (Date.UTC(year, month, day) < Date.UTC(2026, 9, 25) ? 2 : 1) * HOUR_MS,
      at: () => {
        throw new Error('unused')
      },
      dayOf: () => {
        throw new Error('unused')
      },
    }
    expect(eventsSpanWindow({ kind: 'week', start: { year: 2026, month: 9, day: 19 } }, zone)).toEqual({
      start: Date.UTC(2026, 9, 19) - 2 * HOUR_MS,
      end: Date.UTC(2026, 9, 26) - HOUR_MS - 1,
    })
    expect(eventsSpanWindow({ kind: 'agenda', start: { year: 2026, month: 9, day: 19 }, days: 14 }, zone)).toEqual({
      start: Date.UTC(2026, 9, 19) - 2 * HOUR_MS,
      end: Date.UTC(2026, 10, 2) - HOUR_MS - 1,
    })
  })
})

describe('sameEventsSpan', () => {
  test('tells the kinds apart, even over the same day', () => {
    const start = { year: 2026, month: 8, day: 21 }
    expect(sameEventsSpan({ kind: 'week', start }, { kind: 'day', start })).toBe(false)
    expect(sameEventsSpan({ kind: 'agenda', start, days: 7 }, { kind: 'week', start })).toBe(false)
  })

  test('compares a month by year and month', () => {
    const span: EventsSpan = { kind: 'month', year: 2026, month: 8 }
    expect(sameEventsSpan(span, { kind: 'month', year: 2026, month: 8 })).toBe(true)
    expect(sameEventsSpan(span, { kind: 'month', year: 2026, month: 9 })).toBe(false)
    expect(sameEventsSpan(span, { kind: 'month', year: 2027, month: 8 })).toBe(false)
  })

  test('compares an agenda by its first date and its length', () => {
    const start = { year: 2026, month: 9, day: 21 }
    const span: EventsSpan = { kind: 'agenda', start, days: 14 }
    expect(sameEventsSpan(span, { kind: 'agenda', start: { ...start }, days: 14 })).toBe(true)
    expect(sameEventsSpan(span, { kind: 'agenda', start: { ...start, day: 22 }, days: 14 })).toBe(false)
    expect(sameEventsSpan(span, { kind: 'agenda', start, days: 7 })).toBe(false)
    expect(sameEventsSpan(span, { kind: 'agenda', start, days: 28 })).toBe(false)
  })

  test('compares a week and a day by their first date', () => {
    const span: EventsSpan = { kind: 'week', start: { year: 2026, month: 8, day: 21 } }
    expect(sameEventsSpan(span, { kind: 'week', start: { year: 2026, month: 8, day: 21 } })).toBe(true)
    expect(sameEventsSpan(span, { kind: 'week', start: { year: 2026, month: 8, day: 28 } })).toBe(false)
    expect(sameEventsSpan(span, { kind: 'week', start: { year: 2026, month: 9, day: 21 } })).toBe(false)
  })
})

describe('toEventsSpan', () => {
  test('accepts each kind, keeping only the fields it knows', () => {
    expect(toEventsSpan({ kind: 'month', year: 2026, month: 8, day: 9 })).toEqual({
      kind: 'month',
      year: 2026,
      month: 8,
    })
    expect(toEventsSpan({ kind: 'week', start: { year: 2026, month: 8, day: 21 } })).toEqual({
      kind: 'week',
      start: { year: 2026, month: 8, day: 21 },
    })
    expect(toEventsSpan({ kind: 'day', start: { year: 2026, month: 8, day: 21 } })).toEqual({
      kind: 'day',
      start: { year: 2026, month: 8, day: 21 },
    })
    expect(toEventsSpan({ kind: 'agenda', start: { year: 2026, month: 9, day: 21 }, days: 14, end: 3 })).toEqual({
      kind: 'agenda',
      start: { year: 2026, month: 9, day: 21 },
      days: 14,
    })
  })

  test.each([7, 14, 28] as const)('accepts an agenda of %i days', (days) => {
    expect(toEventsSpan({ kind: 'agenda', start: { year: 2026, month: 9, day: 21 }, days })).toEqual({
      kind: 'agenda',
      start: { year: 2026, month: 9, day: 21 },
      days,
    })
  })

  test.each([
    ['not an object', 'week'],
    ['null', null],
    ['no kind', { year: 2026, month: 8 }],
    ['an unknown kind', { kind: 'year', year: 2026 }],
    ['a month out of range', { kind: 'month', year: 2026, month: 12 }],
    ['a week with no start', { kind: 'week' }],
    ['a week whose start is a month', { kind: 'week', start: { year: 2026, month: 8 } }],
    ['an agenda with no start', { kind: 'agenda', days: 14 }],
    ['an agenda with no length', { kind: 'agenda', start: { year: 2026, month: 9, day: 21 } }],
    ['an agenda of a length not offered', { kind: 'agenda', start: { year: 2026, month: 9, day: 21 }, days: 10 }],
    ['an agenda whose length is text', { kind: 'agenda', start: { year: 2026, month: 9, day: 21 }, days: '14' }],
    ['a day with a day out of range', { kind: 'day', start: { year: 2026, month: 8, day: 0 } }],
  ])('rejects %s', (_, value) => {
    expect(toEventsSpan(value)).toBeNull()
  })
})

describe('eventsSpanLength', () => {
  test('counts a day, a week and an agenda in days', () => {
    const start = { year: 2026, month: 2, day: 9 }
    expect(eventsSpanLength({ kind: 'day', start })).toBe(1)
    expect(eventsSpanLength({ kind: 'week', start })).toBe(7)
    expect(eventsSpanLength({ kind: 'agenda', start, days: 7 })).toBe(7)
    expect(eventsSpanLength({ kind: 'agenda', start, days: 28 })).toBe(28)
  })
})

describe('toEventsAgendaDays', () => {
  test('accepts only the lengths offered, the default among them', () => {
    expect(toEventsAgendaDays(7)).toBe(7)
    expect(toEventsAgendaDays(14)).toBe(14)
    expect(toEventsAgendaDays(28)).toBe(28)
    expect(toEventsAgendaDays(DEFAULT_AGENDA_DAYS)).toBe(14)
    expect(toEventsAgendaDays(10)).toBeNull()
    expect(toEventsAgendaDays('7')).toBeNull()
    expect(toEventsAgendaDays(undefined)).toBeNull()
  })
})
