import type { FeedsDay, FeedsTimeZone } from '../../domain'

/** The time zone of the machine the app runs on, through `Date`'s local-time methods. */
export class LocalFeedsTimeZone implements FeedsTimeZone {
  startOfDay({ year, month, day }: FeedsDay): number {
    return this.at({ year, month, day }, 0)
  }

  at({ year, month, day }: FeedsDay, minute: number): number {
    const date = new Date(year, month, day, 0, minute)
    // `new Date` reads years 0 to 99 as 1900 to 1999.
    date.setFullYear(year, month, day)
    return date.getTime()
  }
}
