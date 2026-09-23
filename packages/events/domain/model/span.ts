import {
  sameEventsMonth,
  toEventsDay,
  toEventsMonth,
  type EventsDay,
  type EventsMonth
} from './month'

/**
 * The stretch of calendar on screen. Each kind carries only what pins it down — a month needs
 * no length, a week and a day no end — so no two fields of a span can ever disagree.
 *
 * `week` names the seven days from `start`, whichever weekday that is: which day a week opens
 * on is the user's preference, settled before the span is asked for.
 */
export type EventsSpan =
  | ({ kind: 'month' } & EventsMonth)
  | { kind: 'week'; start: EventsDay }
  | { kind: 'day'; start: EventsDay }

export type EventsSpanKind = EventsSpan['kind']

export function sameEventsSpan(a: EventsSpan, b: EventsSpan): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'month') return sameEventsMonth(a, b as EventsMonth)
  const other = (b as { start: EventsDay }).start
  return sameEventsMonth(a.start, other) && a.start.day === other.day
}

/** Null unless `value` is a span whose kind and dates are all in range. */
export function toEventsSpan(value: unknown): EventsSpan | null {
  if (typeof value !== 'object' || value === null) return null
  const { kind } = value as Record<string, unknown>

  if (kind === 'month') {
    const month = toEventsMonth(value)
    return month && { kind, ...month }
  }
  if (kind === 'week' || kind === 'day') {
    const start = toEventsDay((value as Record<string, unknown>).start)
    return start && { kind, start }
  }
  return null
}