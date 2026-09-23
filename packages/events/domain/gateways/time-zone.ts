import type { EventsDay } from '../model/month'

/**
 * The user's time zone, injected so the domain never depends on the machine it runs on: the
 * composition root supplies the machine's, tests a fixed one.
 */
export interface EventsTimeZone {
  /**
   * Epoch milliseconds of the day's first instant. A `day` or `month` outside its normal range
   * rolls over as `Date` does, so callers can name a day relative to another — the day after
   * the 31st, or a week before the 1st — without doing calendar arithmetic themselves.
   */
  startOfDay(day: EventsDay): number
  /** `instant` is epoch milliseconds. */
  dayOf(instant: number): EventsDay
}
