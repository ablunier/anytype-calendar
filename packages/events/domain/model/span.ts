import { type EventsDay, type EventsMonth, sameEventsMonth, toEventsDay, toEventsMonth } from './month'

/** The lengths an agenda may list, in days: whole weeks, so each step back or on is a familiar one. */
export const EVENTS_AGENDA_LENGTHS = [7, 14, 28] as const

export type EventsAgendaDays = (typeof EVENTS_AGENDA_LENGTHS)[number]

export const DEFAULT_AGENDA_DAYS: EventsAgendaDays = 14

export function toEventsAgendaDays(value: unknown): EventsAgendaDays | null {
  return EVENTS_AGENDA_LENGTHS.includes(value as EventsAgendaDays) ? (value as EventsAgendaDays) : null
}

/**
 * The stretch of calendar on screen. Each kind carries only what pins it down — a month needs
 * no length, a week, a day and an agenda no end — so no two fields of a span can ever disagree.
 *
 * `week` names the seven days from `start`, whichever weekday that is: which day a week opens
 * on is the user's preference, settled before the span is asked for. `agenda` names the `days`
 * days from `start`: its length is the user's preference too, but carried in the span, so a
 * span alone still says what to read.
 */
export type EventsSpan =
  | ({ kind: 'month' } & EventsMonth)
  | { kind: 'week'; start: EventsDay }
  | { kind: 'day'; start: EventsDay }
  | { kind: 'agenda'; start: EventsDay; days: EventsAgendaDays }

export type EventsSpanKind = EventsSpan['kind']

/** In days, for every kind but a month, whose length depends on which month it is. */
export function eventsSpanLength(span: Exclude<EventsSpan, { kind: 'month' }>): number {
  return span.kind === 'agenda' ? span.days : span.kind === 'week' ? 7 : 1
}

export function sameEventsSpan(a: EventsSpan, b: EventsSpan): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'month') return sameEventsMonth(a, b as EventsMonth)
  const other = (b as { start: EventsDay }).start
  if (a.kind === 'agenda' && a.days !== (b as { days: EventsAgendaDays }).days) return false
  return sameEventsMonth(a.start, other) && a.start.day === other.day
}

/** Null unless `value` is a span whose kind, dates and, for an agenda, length are all allowed. */
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
  if (kind === 'agenda') {
    const start = toEventsDay((value as Record<string, unknown>).start)
    const days = toEventsAgendaDays((value as Record<string, unknown>).days)
    return start && days && { kind, start, days }
  }
  return null
}
