import type { EventsObjectRef } from '../gateways/events-gateway'
import type { EventsTimeZone } from '../gateways/time-zone'
import type { EventsWindow } from './window'
import type { EventsSource } from './source'

export interface EventsDatedObject {
  /** Anytype's object id. */
  id: string
  spaceId: string
  typeKey: string
  title: string
  /** Epoch milliseconds, from the type's From property. */
  start: number
  /** Epoch milliseconds, from the type's To property. Null when there is none, or it precedes `start`. */
  end: number | null
  allDay: boolean
}

/**
 * Anytype's local API does not say whether a date property includes a time, and a date
 * without one is stored as the first instant of that day where it was set. So a date is
 * taken as all-day exactly when it falls on the first instant of a day; a time set to
 * midnight reads as all-day too, which draws the same day either way.
 *
 * A To date before the From date, which Anytype allows, is dropped rather than drawn as a
 * range running backwards: the object shows on its From date alone.
 */
export function toEventsDatedObject(
  { id, title, start, end }: EventsObjectRef,
  { spaceId, typeKey }: EventsSource,
  zone: EventsTimeZone
): EventsDatedObject {
  const kept = end !== null && end >= start ? end : null
  const allDay = isStartOfDay(start, zone) && (kept === null || isStartOfDay(kept, zone))
  return { id, spaceId, typeKey, title, start, end: kept, allDay }
}

export function overlapsEventsWindow(
  { start, end }: Pick<EventsDatedObject, 'start' | 'end'>,
  window: EventsWindow
): boolean {
  return start <= window.end && (end ?? start) >= window.start
}

/** Earliest first; objects starting together by title, then id, so the order is stable. */
export function compareEventsDatedObjects(a: EventsDatedObject, b: EventsDatedObject): number {
  if (a.start !== b.start) return a.start - b.start
  if (a.title !== b.title) return a.title < b.title ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function isStartOfDay(instant: number, zone: EventsTimeZone): boolean {
  return zone.startOfDay(zone.dayOf(instant)) === instant
}
