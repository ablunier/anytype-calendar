/** A month of the user's calendar. `month` is zero-based, as in `Date`. */
export interface EventsMonth {
  year: number
  month: number
}

/** A date of the user's calendar. `month` is zero-based, as in `Date`. */
export interface EventsDay extends EventsMonth {
  day: number
}

/**
 * Four-digit years only: Anytype reads dates as RFC 3339, which has no room for a sign or a
 * fifth digit.
 */
const MIN_YEAR = 1
const MAX_YEAR = 9999

export function shiftEventsMonth({ year, month }: EventsMonth, delta: number): EventsMonth {
  const index = year * 12 + month + delta
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 }
}

export function sameEventsMonth(a: EventsMonth, b: EventsMonth): boolean {
  return a.year === b.year && a.month === b.month
}

/** Null unless `value` is a month with an integer year from 1 to 9999 and a month from 0 to 11. */
export function toEventsMonth(value: unknown): EventsMonth | null {
  if (typeof value !== 'object' || value === null) return null
  const { year, month } = value as Record<string, unknown>
  if (!isIntegerIn(year, MIN_YEAR, MAX_YEAR) || !isIntegerIn(month, 0, 11)) return null
  return { year, month }
}

function isIntegerIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}
