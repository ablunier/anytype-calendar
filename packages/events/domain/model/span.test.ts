import { describe, expect, test } from 'vitest'
import type { EventsTimeZone } from '../gateways/time-zone'
import { AGENDA_DAYS, type EventsSpan, eventsSpanLength, sameEventsSpan, toEventsSpan } from './span'
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

  test('runs an agenda from its first day to the last instant of its fourteenth', () => {
    expect(eventsSpanWindow({ kind: 'agenda', start: { year: 2026, month: 9, day: 21 } }, UTC)).toEqual({
      start: Date.UTC(2026, 9, 21),
      end: Date.UTC(2026, 10, 4) - 1,
    })
  })

  test('runs an agenda across the end of a month, and of a year', () => {
    expect(eventsSpanWindow({ kind: 'agenda', start: { year: 2026, month: 1, day: 20 } }, UTC)).toEqual({
      start: Date.UTC(2026, 1, 20),
      end: Date.UTC(2026, 2, 6) - 1,
    })
    expect(eventsSpanWindow({ kind: 'agenda', start: { year: 2026, month: 11, day: 25 } }, UTC)).toEqual({
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
    expect(eventsSpanWindow({ kind: 'agenda', start: { year: 2026, month: 9, day: 19 } }, zone)).toEqual({
      start: Date.UTC(2026, 9, 19) - 2 * HOUR_MS,
      end: Date.UTC(2026, 10, 2) - HOUR_MS - 1,
    })
  })
})

describe('sameEventsSpan', () => {
  test('tells the kinds apart, even over the same day', () => {
    const start = { year: 2026, month: 8, day: 21 }
    expect(sameEventsSpan({ kind: 'week', start }, { kind: 'day', start })).toBe(false)
    expect(sameEventsSpan({ kind: 'agenda', start }, { kind: 'week', start })).toBe(false)
  })

  test('compares a month by year and month', () => {
    const span: EventsSpan = { kind: 'month', year: 2026, month: 8 }
    expect(sameEventsSpan(span, { kind: 'month', year: 2026, month: 8 })).toBe(true)
    expect(sameEventsSpan(span, { kind: 'month', year: 2026, month: 9 })).toBe(false)
    expect(sameEventsSpan(span, { kind: 'month', year: 2027, month: 8 })).toBe(false)
  })

  test('compares an agenda by its first date', () => {
    const span: EventsSpan = { kind: 'agenda', start: { year: 2026, month: 9, day: 21 } }
    expect(sameEventsSpan(span, { kind: 'agenda', start: { year: 2026, month: 9, day: 21 } })).toBe(true)
    expect(sameEventsSpan(span, { kind: 'agenda', start: { year: 2026, month: 9, day: 22 } })).toBe(false)
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
    expect(toEventsSpan({ kind: 'agenda', start: { year: 2026, month: 9, day: 21 }, days: 30 })).toEqual({
      kind: 'agenda',
      start: { year: 2026, month: 9, day: 21 },
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
    ['an agenda with no start', { kind: 'agenda' }],
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
    expect(eventsSpanLength({ kind: 'agenda', start })).toBe(AGENDA_DAYS)
  })
})
