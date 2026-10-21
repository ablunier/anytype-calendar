import ICAL from 'ical.js'
import {
  overlapsFeedsWindow,
  type FeedsCalendar,
  type FeedsCalendarParser,
  type FeedsOccurrence,
  type FeedsTimeZone,
  type FeedsWindow
} from '../../domain'

type IcalComponent = InstanceType<typeof ICAL.Component>
type IcalEvent = InstanceType<typeof ICAL.Event>
type IcalTime = InstanceType<typeof ICAL.Time>

/**
 * Bounds a rule with no end that recurs far more often than any calendar does, e.g. every
 * second: what it would have recurred after that many instances is left out.
 */
const MAX_INSTANCES = 25_000

const DAY_MS = 86_400_000

/** Re-reading a feed that has not changed, every half hour, should not expand it all again. */
const REMEMBERED_FEEDS = 16

/** Reads iCalendar (RFC 5545) feeds with ical.js. */
export class IcalFeedsCalendarParser implements FeedsCalendarParser {
  readonly #zone: FeedsTimeZone
  readonly #parsed = new Map<string, FeedsCalendar>()

  constructor(zone: FeedsTimeZone) {
    this.#zone = zone
  }

  parse(text: string): FeedsCalendar | null {
    const remembered = this.#parsed.get(text)
    if (remembered) return remembered
    const calendar = parseCalendar(text, this.#zone)
    if (calendar) {
      this.#parsed.set(text, calendar)
      for (const old of this.#parsed.keys()) {
        if (this.#parsed.size <= REMEMBERED_FEEDS) break
        this.#parsed.delete(old)
      }
    }
    return calendar
  }
}

function parseCalendar(text: string, zone: FeedsTimeZone): FeedsCalendar | null {
  // Cheaper than letting ical.js choke on an HTML sign-in page.
  if (!/^\s*BEGIN:VCALENDAR/i.test(text)) return null
  let root: IcalComponent
  try {
    const parsed: unknown = ICAL.parse(text)
    // Several calendars in one text parse to a list of them; the first is read.
    const first = Array.isArray(parsed) && Array.isArray(parsed[0]) ? parsed[0] : parsed
    root = new ICAL.Component(first as ConstructorParameters<typeof ICAL.Component>[0])
  } catch {
    return null
  }
  return root.name === 'vcalendar' ? new IcalFeedsCalendar(root, zone) : null
}

/**
 * One event of the feed: a recurring one with the instances it overrides (`RECURRENCE-ID`)
 * related to it, so ical.js expands it with them.
 */
interface FeedsSeries {
  id: string
  event: IcalEvent
}

class IcalFeedsCalendar implements FeedsCalendar {
  readonly name: string | null
  readonly #series: FeedsSeries[]
  readonly #zone: FeedsTimeZone
  readonly #instants: Instants
  readonly #rules = new Map<FeedsSeries, RuleInstances>()

  constructor(root: IcalComponent, zone: FeedsTimeZone) {
    const name = root.getFirstPropertyValue('x-wr-calname')
    this.name = typeof name === 'string' && name.trim() !== '' ? name.trim() : null
    this.#zone = zone
    this.#instants = new Instants(zone)
    this.#series = seriesOf(root.getAllSubcomponents('vevent'))
  }

  occurrencesIn(window: FeedsWindow): FeedsOccurrence[] {
    const occurrences: FeedsOccurrence[] = []
    for (const series of this.#series) {
      try {
        if (series.event.isRecurring()) this.#expand(series, window, occurrences)
        else this.#single(series, window, occurrences)
      } catch {
        // One event ical.js cannot read, e.g. a malformed rule, costs only itself.
      }
    }
    return occurrences
  }

  #single({ id, event }: FeedsSeries, window: FeedsWindow, into: FeedsOccurrence[]): void {
    if (cancelled(event)) return
    const occurrence = this.#occurrence(id, event, event.endDate, tzidOf(event.component, 'dtend'))
    if (occurrence && overlapsFeedsWindow(occurrence, window)) into.push(occurrence)
  }

  /**
   * The instances the rule makes near the window, then each override wherever it moved its
   * instance: into the window from outside it, or out of it.
   */
  #expand(series: FeedsSeries, window: FeedsWindow, into: FeedsOccurrence[]): void {
    const { id, event } = series
    if (cancelled(event)) return
    let rule = this.#rules.get(series)
    if (!rule) {
      rule = new RuleInstances(event)
      this.#rules.set(series, rule)
    }
    const tzid = tzidOf(event.component, 'dtstart')
    for (const time of rule.near(window)) {
      const details = event.getOccurrenceDetails(time)
      // An instance overridden on its own is drawn by the pass over the overrides below; one
      // a range override (THISANDFUTURE) shifts is drawn here, as it shifts it.
      if (details.item !== event && details.item.recurrenceId.compare(time) === 0) continue
      if (cancelled(details.item)) continue
      const recursAt = this.#instants.of(time, tzid)
      // An instance the rule makes ends a duration after it starts, in the zone it starts in.
      const occurrence = this.#occurrence(`${id}#${recursAt}`, details.item, details.endDate, tzid, details.startDate)
      if (occurrence && overlapsFeedsWindow(occurrence, window)) into.push(occurrence)
    }
    for (const exception of Object.values(event.exceptions)) {
      if (cancelled(exception)) continue
      const recursAt = this.#instants.of(exception.recurrenceId, tzidOf(exception.component, 'recurrence-id'))
      const occurrence = this.#occurrence(
        `${id}#${recursAt}`,
        exception,
        exception.endDate,
        tzidOf(exception.component, 'dtend')
      )
      if (occurrence && overlapsFeedsWindow(occurrence, window)) into.push(occurrence)
    }
  }
  /**
   * `item` is the event, or the override, whose fields the occurrence carries; it starts at
   * `startDate`, by default the item's own. `endTzid` is the zone `endDate` was given in, when
   * it names one; it defaults to the start's.
   */
  #occurrence(
    id: string,
    item: IcalEvent,
    endDate: IcalTime | null,
    endTzid: string | null,
    startDate: IcalTime | null = item.startDate
  ): FeedsOccurrence | null {
    if (!startDate) return null
    const component = item.component
    const startTzid = tzidOf(component, 'dtstart')
    const allDay = startDate.isDate
    const start = this.#instants.of(startDate, startTzid)
    let end: number | null = null
    if (endDate) {
      if (allDay) {
        // DTEND is exclusive: an event of one day ends on the next.
        const last = this.#zone.startOfDay({ year: endDate.year, month: endDate.month - 1, day: endDate.day - 1 })
        end = last > start ? last : null
      } else {
        const instant = this.#instants.of(endDate, endTzid ?? startTzid)
        end = instant > start ? instant : null
      }
    }
    const occurrence: FeedsOccurrence = { id, title: textOf(component, 'summary') ?? '', start, end, allDay }
    const location = textOf(component, 'location')
    if (location !== null) occurrence.location = location
    const description = textOf(component, 'description')
    if (description !== null) occurrence.description = description
    const url = textOf(component, 'url')
    if (url !== null && /^https?:\/\/\S+$/i.test(url)) occurrence.url = url
    return occurrence
  }
}

/**
 * The feed's events, each override related to the event it overrides. An override whose event
 * the feed leaves out is drawn on its own. An event with no UID, or one sharing another's, is
 * told apart by where it stands in the feed.
 */
function seriesOf(vevents: IcalComponent[]): FeedsSeries[] {
  const overrides = new Map<string, IcalComponent[]>()
  const masters: { uid: string; component: IcalComponent; index: number }[] = []
  vevents.forEach((component, index) => {
    const uid = uidOf(component)
    if (component.hasProperty('recurrence-id') && uid !== null) {
      overrides.set(uid, [...(overrides.get(uid) ?? []), component])
    } else {
      masters.push({ uid: uid ?? '', component, index })
    }
  })
  const counts = new Map<string, number>()
  for (const { uid } of masters) counts.set(uid, (counts.get(uid) ?? 0) + 1)
  const series: FeedsSeries[] = masters.map(({ uid, component, index }) => {
    const exceptions = overrides.get(uid) ?? []
    overrides.delete(uid)
    return {
      id: uid !== '' && counts.get(uid) === 1 ? uid : `${uid}~${index}`,
      event: new ICAL.Event(component, { exceptions, strictExceptions: true })
    }
  })
  for (const [uid, components] of overrides) {
    components.forEach((component, index) => {
      series.push({ id: `${uid}~override${index}`, event: new ICAL.Event(component, { exceptions: [] }) })
    })
  }
  return series
}

function uidOf(component: IcalComponent): string | null {
  return textOf(component, 'uid')
}

function cancelled(event: IcalEvent): boolean {
  return textOf(event.component, 'status')?.toUpperCase() === 'CANCELLED'
}

function textOf(component: IcalComponent, name: string): string | null {
  const value = component.getFirstPropertyValue(name)
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text === '' ? null : text
}

function tzidOf(component: IcalComponent, name: string): string | null {
  const tzid = component.getFirstProperty(name)?.getParameter('tzid')
  return typeof tzid === 'string' && tzid !== '' ? tzid : null
}

/**
 * A rule's instances, walked once from its first and remembered, so moving between windows
 * only walks on past the furthest one asked for. Each is kept with its wall-clock time read as
 * if it were UTC, which no zone puts more than a day from its instant: that rules most of them
 * out of a window without working out an instant for any.
 */
class RuleInstances {
  readonly #iterator: ReturnType<IcalEvent['iterator']>
  readonly #times: IcalTime[] = []
  readonly #walls: number[] = []
  /** How long the rule's own instances last, in wall-clock milliseconds. */
  readonly #length: number
  #done = false

  constructor(event: IcalEvent) {
    this.#iterator = event.iterator()
    this.#length = event.duration.toSeconds() * 1000
  }

  /** The instances that may overlap the window, give or take the day either side a zone may be. */
  near(window: FeedsWindow): IcalTime[] {
    const until = window.end + DAY_MS
    while (!this.#done && (this.#walls.at(-1) ?? -Infinity) <= until) this.#walk()
    const from = window.start - DAY_MS - this.#length
    const near: IcalTime[] = []
    for (let index = firstAtOrAfter(this.#walls, from); index < this.#walls.length; index++) {
      if ((this.#walls[index] ?? Infinity) > until) break
      const time = this.#times[index]
      if (time) near.push(time)
    }
    return near
  }

  #walk(): void {
    const next = this.#iterator.next()
    if (!next || this.#times.length >= MAX_INSTANCES) {
      this.#done = true
      return
    }
    this.#times.push(next)
    this.#walls.push(wallOfTime(next))
  }
}

/** The index of the first of the ascending `values` at or after `value`. */
function firstAtOrAfter(values: readonly number[], value: number): number {
  let low = 0
  let high = values.length
  while (low < high) {
    const middle = (low + high) >> 1
    if ((values[middle] ?? Infinity) < value) low = middle + 1
    else high = middle
  }
  return low
}

function wallOfTime(time: IcalTime): number {
  return Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute, time.second)
}

/** Turns ical.js times into epoch milliseconds, each by the zone it was given in. */
class Instants {
  readonly #zone: FeedsTimeZone
  readonly #formats = new Map<string, Intl.DateTimeFormat | null>()

  constructor(zone: FeedsTimeZone) {
    this.#zone = zone
  }

  /**
   * A date is a day of the user's own calendar, and so is a floating time, which names no
   * zone. A time in a zone the feed defines (`VTIMEZONE`) is read by that definition; one in a
   * zone it names but leaves undefined, which ical.js reads as floating, is read by the IANA
   * zone of that name where there is one.
   */
  of(time: IcalTime, tzid: string | null): number {
    const day = { year: time.year, month: time.month - 1, day: time.day }
    if (time.isDate) return this.#zone.startOfDay(day)
    if (time.zone !== ICAL.Timezone.localTimezone) return time.toUnixTime() * 1000
    const wall = wallOfTime(time)
    const zoned = tzid === null ? null : this.#zoned(wall, tzid)
    return zoned ?? this.#zone.at(day, time.hour * 60 + time.minute) + time.second * 1000
  }

  /** `wall` is the wall-clock time as if it were UTC; null for a zone `Intl` does not know. */
  #zoned(wall: number, tzid: string): number | null {
    const format = this.#format(tzid)
    if (!format) return null
    // An offset read at a first guess, then at the instant it gives, settles on the right side
    // of a change of the clocks.
    const offsetAt = (instant: number): number => wallOf(format, instant) - instant
    const guess = wall - offsetAt(wall)
    return wall - offsetAt(guess)
  }

  #format(tzid: string): Intl.DateTimeFormat | null {
    let format = this.#formats.get(tzid)
    if (format === undefined) {
      try {
        format = new Intl.DateTimeFormat('en-US', {
          timeZone: tzid,
          hourCycle: 'h23',
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric'
        })
      } catch {
        format = null
      }
      this.#formats.set(tzid, format)
    }
    return format
  }
}

/** The wall-clock time `format`'s zone shows at `instant`, as if it were UTC. */
function wallOf(format: Intl.DateTimeFormat, instant: number): number {
  const parts: Record<string, number> = {}
  for (const { type, value } of format.formatToParts(instant)) parts[type] = Number(value)
  return Date.UTC(
    parts['year'] ?? 1970,
    (parts['month'] ?? 1) - 1,
    parts['day'] ?? 1,
    parts['hour'] ?? 0,
    parts['minute'] ?? 0,
    parts['second'] ?? 0
  )
}
