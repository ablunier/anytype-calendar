import type { EventsTimeZone } from '../gateways/time-zone'
import type { EventsWriteFailure } from '../gateways/events-writer'
import { compareEventsDatedObjects, type EventsDatedObject } from './dated-object'
import { toEventsDay, type EventsDay } from './month'
import type { EventsTypeSource } from './source'
import type { EventsSpanLoad } from './span-load'

const MINUTES_PER_DAY = 1440
const DAY_MS = 86_400_000
const MINUTE_MS = 60_000

/** Where a new object is timed when the user named a day but no time of it. */
const DEFAULT_START_MINUTE = 9 * 60

/** How long a new timed object with a To date lasts. */
const DEFAULT_DURATION_MINUTES = 60

/**
 * A place on the user's calendar: a day, and the minute of it from midnight. `minute` is null
 * where the grid it was picked on has no times, e.g. a month cell.
 */
export interface EventsSlot {
  day: EventsDay
  minute: number | null
}

export type EventsReschedule =
  /** Its From moves to `start`, and its To with it, so it lasts as long as it did. */
  | { kind: 'move'; start: EventsSlot }
  /** Its To moves to `end`; its From stays. */
  | { kind: 'resize'; end: EventsSlot }

/**
 * Why an edit from the calendar did not happen: Anytype's own refusals, plus the ones found
 * before asking it.
 */
export type EventsEditFailure =
  | EventsWriteFailure
  /** Anytype did not answer, or answered with something unusable. */
  | { failure: 'unreachable' }
  /** The object, or the pick it was read through, is no longer on the calendar. */
  | { failure: 'gone' }
  /** The change cannot be made to this object, e.g. a To date before its From. */
  | { failure: 'invalid' }

export type EventsEditOutcome = { ok: true } | ({ ok: false } & EventsEditFailure)

/** Null unless `value` is a slot whose day is in range and whose minute, if any, is within it. */
export function toEventsSlot(value: unknown): EventsSlot | null {
  if (typeof value !== 'object' || value === null) return null
  const { day, minute } = value as Record<string, unknown>
  const date = toEventsDay(day)
  if (!date) return null
  if (minute === null) return { day: date, minute }
  const valid =
    typeof minute === 'number' && Number.isInteger(minute) && minute >= 0 && minute < MINUTES_PER_DAY
  return valid ? { day: date, minute } : null
}

export function toEventsReschedule(value: unknown): EventsReschedule | null {
  if (typeof value !== 'object' || value === null) return null
  const { kind, start, end } = value as Record<string, unknown>
  if (kind === 'move') {
    const slot = toEventsSlot(start)
    return slot && { kind, start: slot }
  }
  if (kind === 'resize') {
    const slot = toEventsSlot(end)
    return slot && { kind, end: slot }
  }
  return null
}

/**
 * The object as the change leaves it, or null when the change would put its To before its
 * From. An all-day date is written as the first instant of its day, which is how Anytype
 * itself stores a date set without a time; an all-day range keeps how many days it covers, a
 * timed one how long it lasts. A timed object moved to a slot with no minute keeps its time of
 * day.
 */
export function rescheduleEventsDatedObject(
  object: EventsDatedObject,
  change: EventsReschedule,
  zone: EventsTimeZone
): EventsDatedObject | null {
  const { start, end, allDay } = object

  if (change.kind === 'resize') {
    const { day, minute } = change.end
    const moved = allDay ? zone.startOfDay(day) : zone.at(day, minute ?? minuteOf(end ?? start, zone))
    return moved >= start ? { ...object, end: moved } : null
  }

  const { day, minute } = change.start
  if (allDay) {
    const moved = zone.startOfDay(day)
    if (end === null) return { ...object, start: moved, end: null }
    const days = daysBetween(start, end, zone)
    return { ...object, start: moved, end: zone.startOfDay({ ...day, day: day.day + days }) }
  }
  const moved = zone.at(day, minute ?? minuteOf(start, zone))
  return { ...object, start: moved, end: end === null ? null : moved + (end - start) }
}

/**
 * Where a new object of the source goes: at the slot's minute when its dates carry a time, at
 * nine when the slot has none, and on the day alone otherwise. Where the source has a To date
 * it is filled too, so the object is drawn as the range it is: an hour long, or the one day.
 */
export function newEventsObjectDates(
  { from, to, includesTime }: EventsTypeSource,
  { day, minute }: EventsSlot,
  zone: EventsTimeZone
): Record<string, number> {
  const start = includesTime ? zone.at(day, minute ?? DEFAULT_START_MINUTE) : zone.startOfDay(day)
  if (to === null || to === from) return { [from]: start }
  return { [from]: start, [to]: includesTime ? start + DEFAULT_DURATION_MINUTES * MINUTE_MS : start }
}

/**
 * The load as it will be once the writes in flight land: each object in `edits` drawn in place
 * of the one it edits, so a dragged object does not snap back to where it was while Anytype
 * is being asked. A later edit of the same object wins. The same load when none of them is in
 * its result.
 */
export function withEventsEdits(load: EventsSpanLoad, edits: readonly EventsDatedObject[]): EventsSpanLoad {
  if (load.phase === 'idle' || !load.last || edits.length === 0) return load
  const byObject = new Map(edits.map((edit) => [objectKey(edit), edit]))
  let changed = false
  const objects = load.last.objects.map((object) => {
    const edit = byObject.get(objectKey(object))
    if (!edit) return object
    changed = true
    return edit
  })
  if (!changed) return load
  return { ...load, last: { ...load.last, objects: objects.sort(compareEventsDatedObjects) } }
}

export function sameEventsObject(
  a: Pick<EventsDatedObject, 'spaceId' | 'id'>,
  b: Pick<EventsDatedObject, 'spaceId' | 'id'>
): boolean {
  return a.spaceId === b.spaceId && a.id === b.id
}

/** Space ids and object ids never contain a newline, so the pair cannot collide. */
function objectKey({ spaceId, id }: Pick<EventsDatedObject, 'spaceId' | 'id'>): string {
  return `${spaceId}\n${id}`
}

/** Calendar days from the day `a` falls on to the day `b` does; rounded, since a day the clocks change is not 24 hours. */
function daysBetween(a: number, b: number, zone: EventsTimeZone): number {
  return Math.round((zone.startOfDay(zone.dayOf(b)) - zone.startOfDay(zone.dayOf(a))) / DAY_MS)
}

/**
 * The wall-clock minute of the day `instant` falls on. Time elapsed since midnight is only a
 * first guess: on a day the clocks change it is an hour off from the clock, either way.
 */
function minuteOf(instant: number, zone: EventsTimeZone): number {
  const day = zone.dayOf(instant)
  let minute = Math.floor((instant - zone.startOfDay(day)) / MINUTE_MS)
  while (minute + 1 < MINUTES_PER_DAY && zone.at(day, minute + 1) <= instant) minute++
  while (minute > 0 && zone.at(day, minute) > instant) minute--
  return minute
}
