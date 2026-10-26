import type { FeedsFetchResult, FeedsGateway } from '../../domain'

export interface InMemoryFeedsGatewayOptions {
  sleep: (ms: number) => Promise<void>
  now: () => number
  requestLatencyMs?: number
}

/** Any address ending in `.ics` answers the sample; one on this host answers nothing at all. */
export const IN_MEMORY_FEEDS_UNREACHABLE_HOST = 'unreachable.example'

/**
 * A stand-in for the network: every `.ics` address answers inMemoryFeedsSample around the
 * month `now` falls in, any other a web page, which is not a calendar.
 */
export class InMemoryFeedsGateway implements FeedsGateway {
  readonly #sleep: (ms: number) => Promise<void>
  readonly #now: () => number
  readonly #latency: number

  constructor({ sleep, now, requestLatencyMs = 400 }: InMemoryFeedsGatewayOptions) {
    this.#sleep = sleep
    this.#now = now
    this.#latency = requestLatencyMs
  }

  async fetch(url: string): Promise<FeedsFetchResult> {
    await this.#sleep(this.#latency)
    if (url.includes(`//${IN_MEMORY_FEEDS_UNREACHABLE_HOST}`)) return { ok: false, failure: 'unreachable' }
    if (!/\.ics(\?|$)/i.test(url)) return { ok: true, text: '<!doctype html><title>Sign in</title>' }
    return { ok: true, text: inMemoryFeedsSample(this.#now()) }
  }
}

/**
 * A weekly meeting that began two months before `now` (epoch milliseconds), with one week
 * moved and one skipped; an all-day holiday on the 15th; and a call held in New York's time,
 * which lands on the user's clock wherever they are.
 */
export function inMemoryFeedsSample(now: number): string {
  const today = new Date(now)
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstTuesday = new Date(year, month - 2, 1)
  firstTuesday.setDate(1 + ((2 - firstTuesday.getDay() + 7) % 7))
  const tuesday = (weeks: number): Date =>
    new Date(firstTuesday.getFullYear(), firstTuesday.getMonth(), firstTuesday.getDate() + weeks * 7)
  const moved = tuesday(9)
  const skipped = tuesday(10)
  const thursday = new Date(year, month, 1 + ((4 - new Date(year, month, 1).getDay() + 7) % 7) + 7)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Calendar for Anytype//Sample//EN',
    'X-WR-CALNAME:Sample team calendar',
    'BEGIN:VEVENT',
    'UID:sample-weekly-sync',
    `DTSTART:${floating(tuesday(0), 10)}`,
    `DTEND:${floating(tuesday(0), 11)}`,
    'RRULE:FREQ=WEEKLY;BYDAY=TU',
    `EXDATE:${floating(skipped, 10)}`,
    'SUMMARY:Weekly team sync',
    'LOCATION:Meeting room 2',
    'DESCRIPTION:What shipped\\, what is next\\, and what is in the way.',
    'URL:https://example.com/team/sync',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:sample-weekly-sync',
    `RECURRENCE-ID:${floating(moved, 10)}`,
    `DTSTART:${floating(new Date(moved.getFullYear(), moved.getMonth(), moved.getDate() + 1), 15)}`,
    `DTEND:${floating(new Date(moved.getFullYear(), moved.getMonth(), moved.getDate() + 1), 16)}`,
    'SUMMARY:Weekly team sync (moved)',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:sample-holiday',
    `DTSTART;VALUE=DATE:${date(new Date(year, month, 15))}`,
    `DTEND;VALUE=DATE:${date(new Date(year, month, 16))}`,
    'SUMMARY:Company holiday',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:sample-new-york',
    `DTSTART;TZID=America/New_York:${floating(thursday, 9)}`,
    `DTEND;TZID=America/New_York:${floating(thursday, 10)}`,
    'SUMMARY:Call with the New York office',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n')
}

function date(day: Date): string {
  return `${day.getFullYear()}${pad(day.getMonth() + 1)}${pad(day.getDate())}`
}

function floating(day: Date, hour: number): string {
  return `${date(day)}T${pad(hour)}0000`
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
