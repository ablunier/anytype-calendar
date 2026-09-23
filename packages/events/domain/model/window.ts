import type { EventsTimeZone } from '../gateways/time-zone'
import type { EventsDay } from './month'
import type { EventsSpan } from './span'

/** Epoch milliseconds, both ends inclusive. */
export interface EventsWindow {
  start: number
  end: number
}

/**
 * A month grid's first and last rows borrow days from the adjacent months, and a week may open
 * on any weekday, so a month is read with a week of slack on each side: enough to cover the
 * padding of any grid, whichever day the user's week starts on.
 */
const MONTH_PADDING_DAYS = 7

/** From the first instant of the span's first day to the last instant of its last. */
export function eventsSpanWindow(span: EventsSpan, zone: EventsTimeZone): EventsWindow {
  if (span.kind === 'month') {
    const { year, month } = span
    return between(
      { year, month, day: 1 - MONTH_PADDING_DAYS },
      { year, month: month + 1, day: 1 + MONTH_PADDING_DAYS },
      zone
    )
  }
  const days = span.kind === 'week' ? 7 : 1
  return between(span.start, { ...span.start, day: span.start.day + days }, zone)
}

/** `until` is the day after the window's last, so the window ends the instant before it. */
function between(from: EventsDay, until: EventsDay, zone: EventsTimeZone): EventsWindow {
  return { start: zone.startOfDay(from), end: zone.startOfDay(until) - 1 }
}
