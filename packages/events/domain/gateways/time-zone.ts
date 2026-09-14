import type { EventsDay } from '../model/month'

/**
 * The user's time zone, injected so the domain never depends on the machine it runs on: the
 * composition root supplies the machine's, tests a fixed one.
 */
export interface EventsTimeZone {
  /** Epoch milliseconds of the day's first instant. */
  startOfDay(day: EventsDay): number
  /** `instant` is epoch milliseconds. */
  dayOf(instant: number): EventsDay
}
