import { describe, expect, test } from 'vitest'
import { sameEventsMonth, shiftEventsMonth, toEventsDay, toEventsMonth } from './month'

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

describe('toEventsDay', () => {
  test('accepts a day', () => {
    expect(toEventsDay({ year: 2026, month: 8, day: 1 })).toEqual({ year: 2026, month: 8, day: 1 })
    expect(toEventsDay({ year: 2026, month: 8, day: 31 })).toEqual({ year: 2026, month: 8, day: 31 })
  })

  test.each([
    ['no day', { year: 2026, month: 8 }],
    ['day 0', { year: 2026, month: 8, day: 0 }],
    ['day 32', { year: 2026, month: 8, day: 32 }],
    ['a fractional day', { year: 2026, month: 8, day: 3.5 }],
    ['a month it would reject on its own', { year: 2026, month: 12, day: 3 }]
  ])('rejects %s', (_, value) => {
    expect(toEventsDay(value)).toBeNull()
  })
})
