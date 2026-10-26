/* The only renderer module that reads the shape of a feeds snapshot; components get view
 * models. A feed's events become CalendarEvents like Anytype's objects, in the machine's time
 * zone, keyed to their subscription with `feedSourceKey`. */

import type { FeedsEvent, FeedsSubscriptionView } from '@anytype-calendar/feeds/domain'
import type { FeedsSnapshot } from '@shared/ipc'
import type { CalendarEvent, FeedSource, FeedStatus } from '@renderer/types'
import { localDate, localTime } from './events'
import { elapsedSince, hueOf } from './schema'

/** Never a type's or a query's key: those start with a space id, which has no `feed:` in it. */
export function feedSourceKey(id: string): string {
  return `feed:${id}`
}

/** The subscriptions, in the user's order. `now` is epoch milliseconds. */
export function feedsFor(snapshot: FeedsSnapshot, now: number): FeedSource[] {
  return snapshot.subscriptions.map(({ id, name, colour, host, status }) => ({
    key: feedSourceKey(id),
    id,
    name,
    category: hueOf(colour),
    colour,
    host,
    status: statusFor(status, now)
  }))
}

/**
 * The events of the window main last expanded the feeds over. That may still be the span the
 * calendar showed before: each event lands on its own day all the same, and the next push
 * brings the rest.
 */
export function feedEventsFor(snapshot: FeedsSnapshot): CalendarEvent[] {
  const byId = new Map(snapshot.subscriptions.map((subscription) => [subscription.id, subscription]))
  return snapshot.events.flatMap((event) => {
    const subscription = byId.get(event.feedId)
    return subscription ? [calendarEventFor(event, subscription)] : []
  })
}

/**
 * Anytype's events and the feeds' in one list, by day, then all-day first, then by time. Each
 * list keeps its own order otherwise, Anytype's first: a feed's events starting together are
 * already in the user's order of the subscriptions.
 */
export function mergedEvents(anytype: CalendarEvent[], feeds: CalendarEvent[]): CalendarEvent[] {
  if (feeds.length === 0) return anytype
  return [...anytype, ...feeds].sort(
    (a, b) =>
      compare(a.date, b.date) || Number(!a.allDay) - Number(!b.allDay) || compare(a.time ?? '', b.time ?? '')
  )
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function statusFor({ readAt, reading, error }: FeedsSubscriptionView['status'], now: number): FeedStatus {
  const status: FeedStatus = { state: reading ? 'syncing' : error ? 'error' : readAt === null ? 'offline' : 'synced' }
  if (readAt !== null) status.elapsed = elapsedSince(readAt, now)
  if (error) status.failure = error.failure === 'http' ? { failure: 'http', status: error.status } : { failure: error.failure }
  return status
}

/** An occurrence's id is unique within its feed only, so the key is made of both. */
function calendarEventFor(
  { id, feedId, rank, title, start, end, allDay, location, description, url }: FeedsEvent,
  { name, colour }: FeedsSubscriptionView
): CalendarEvent {
  return {
    id: `${feedSourceKey(feedId)}:${id}`,
    title,
    type: feedSourceKey(feedId),
    space: feedSourceKey(feedId),
    rank,
    date: localDate(start),
    allDay,
    ...(allDay ? {} : { time: localTime(start) }),
    ...(end === null ? {} : { until: localDate(end), ...(allDay ? {} : { end: localTime(end) }) }),
    ...(location === undefined ? {} : { location }),
    category: hueOf(colour),
    // Its panel draws the feed's own fields: a feed has no properties for a type to pick.
    details: [],
    feed: {
      calendar: name,
      ...(description === undefined ? {} : { description }),
      ...(url === undefined ? {} : { url })
    }
  }
}

/** `ids` with the one at `from` moved to `to`, the others keeping their order; `to` is clamped. */
export function movedOrder(ids: readonly string[], from: number, to: number): string[] {
  const moved = ids[from]
  if (moved === undefined) return [...ids]
  const rest = ids.filter((_, index) => index !== from)
  rest.splice(Math.min(Math.max(to, 0), rest.length), 0, moved)
  return rest
}
