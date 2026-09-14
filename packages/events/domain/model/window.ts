import type { EventsTimeZone } from '../gateways/time-zone'
import { shiftEventsMonth, type EventsMonth } from './month'

/** Epoch milliseconds, both ends inclusive. */
export interface EventsWindow {
  start: number
  end: number
}

/** From the first instant of the month's first day to the last instant before the next month's. */
export function eventsMonthWindow(month: EventsMonth, zone: EventsTimeZone): EventsWindow {
  const next = shiftEventsMonth(month, 1)
  return {
    start: zone.startOfDay({ ...month, day: 1 }),
    end: zone.startOfDay({ ...next, day: 1 }) - 1
  }
}
