/** A date of the user's calendar. `month` is zero-based, as in `Date`. */
export interface FeedsDay {
  year: number
  month: number
  day: number
}

/**
 * The user's time zone, which dates with no zone of their own are read in: all-day dates, and
 * times a feed leaves floating. Injected, so tests can fix one.
 */
export interface FeedsTimeZone {
  /** Epoch milliseconds of the day's first instant; a `day` out of range rolls over as `Date` does. */
  startOfDay(day: FeedsDay): number
  /**
   * Epoch milliseconds of the wall-clock time `minute` minutes past the day's midnight. Not
   * `startOfDay` plus the minutes: on a day the clocks change, that lands an hour off.
   */
  at(day: FeedsDay, minute: number): number
}
