import type { EventsObjectRef } from '../gateways/events-gateway'
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
  done?: boolean
  location?: string
  /** Anytype's colour name of the option the source colours by; left off to draw the type's. */
  colour?: string
}

/**
 * Anytype's local API does not say whether a date property includes a time — a date set with
 * no time is stored the same way as one set to midnight — so `allDay` follows the source's
 * `includesTime`, which the user states when choosing the type, rather than the instant
 * itself.
 *
 * A To date before the From date, which Anytype allows, is dropped rather than drawn as a
 * range running backwards: the object shows on its From date alone.
 */
export function toEventsDatedObject(
  { id, title, start, end, done, location, option }: EventsObjectRef,
  { spaceId, typeKey, includesTime, colourBy }: EventsSource
): EventsDatedObject {
  const kept = end !== null && end >= start ? end : null
  const object: EventsDatedObject = { id, spaceId, typeKey, title, start, end: kept, allDay: !includesTime }
  if (done !== undefined) object.done = done
  if (location !== undefined && location !== '') object.location = location
  const colour =
    option === undefined ? undefined : colourBy?.options.find(({ name }) => name === option)?.color
  if (colour !== undefined) object.colour = colour
  return object
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
