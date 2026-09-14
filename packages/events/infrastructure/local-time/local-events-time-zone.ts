import type { EventsDay, EventsTimeZone } from '../../domain'

/** The time zone of the machine the app runs on, through `Date`'s local-time methods. */
export class LocalEventsTimeZone implements EventsTimeZone {
  startOfDay({ year, month, day }: EventsDay): number {
    const date = new Date(year, month, day)
    // `new Date` reads years 0 to 99 as 1900 to 1999.
    date.setFullYear(year, month, day)
    return date.getTime()
  }

  dayOf(instant: number): EventsDay {
    const date = new Date(instant)
    return { year: date.getFullYear(), month: date.getMonth(), day: date.getDate() }
  }
}
