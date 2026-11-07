/* The agenda as a list: the days of a span that hold something, each with its rows in the
 * order they are read. Pure and translation-free; `AgendaList` draws it. */

import { AGENDA_DAYS } from '@anytype-calendar/events/domain'
import type { CalendarEvent } from '@renderer/types'
import { addDays, daysBetween } from './calendar'
import { minutesOf } from './time-grid'

/** What a row's time column says. Times are `HH:MM`. */
export type AgendaTime =
  | { kind: 'all-day' }
  /** `end` is set for an object that ends later the same day. */
  | { kind: 'at'; start: string; end?: string }
  /** The last day of a timed range. */
  | { kind: 'until'; end: string }

export interface AgendaRow {
  event: CalendarEvent
  time: AgendaTime
  /** Set on each day of an object that covers several; `day` counts from 1. */
  range?: { day: number; of: number }
  /** The object is over, wherever this row of it falls. */
  ended: boolean
}

export interface AgendaDay {
  /** `YYYY-MM-DD`. */
  date: string
  isToday: boolean
  rows: AgendaRow[]
  /**
   * On today, the index of the first row still to come, before which the current time is
   * drawn: `rows.length` once every row has started. Null on other days, and on a today with no
   * timed rows, where there is nothing for the line to sit between.
   */
  nowBefore: number | null
}

/**
 * The days from `start` (`YYYY-MM-DD`) that `AGENDA_DAYS` covers and that hold at least one
 * row, plus today wherever it falls among them, so the reader can tell where today is. An
 * object that covers several days is a row on each of them. `nowMinute` is minutes from
 * midnight of `today`.
 *
 * `events` are those to draw, each object once: `visibleEvents` has already picked them.
 */
export function buildAgenda(events: CalendarEvent[], start: string, today: string, nowMinute: number): AgendaDay[] {
  const last = addDays(start, AGENDA_DAYS - 1)
  const days: AgendaDay[] = []
  for (let date = start; date <= last; date = addDays(date, 1)) {
    const rows = events
      .filter((event) => event.date <= date && date <= (event.until ?? event.date))
      .map((event) => rowFor(event, date, today, nowMinute))
      .sort(compareRows)
    const isToday = date === today
    if (rows.length === 0 && !isToday) continue
    days.push({ date, isToday, rows, nowBefore: isToday ? nowBeforeIn(rows, nowMinute) : null })
  }
  return days
}

function rowFor(event: CalendarEvent, date: string, today: string, nowMinute: number): AgendaRow {
  const until = event.until ?? event.date
  const of = daysBetween(event.date, until) + 1
  const ended = endedBy(event, today, nowMinute)
  if (of === 1) {
    const time: AgendaTime =
      event.allDay || event.time === undefined
        ? { kind: 'all-day' }
        : { kind: 'at', start: event.time, ...(event.end === undefined ? {} : { end: event.end }) }
    return { event, time, ended }
  }
  const time: AgendaTime =
    event.allDay || event.time === undefined
      ? { kind: 'all-day' }
      : date === event.date
        ? { kind: 'at', start: event.time }
        : date === until && event.end !== undefined
          ? { kind: 'until', end: event.end }
          : { kind: 'all-day' }
  return { event, time, range: { day: daysBetween(event.date, date) + 1, of }, ended }
}

/**
 * Whether the object has ended by `nowMinute` of `today`. An all-day object lasts its whole
 * last day; a timed one with no end of its own is over once it has started.
 */
function endedBy(event: CalendarEvent, today: string, nowMinute: number): boolean {
  const until = event.until ?? event.date
  if (until !== today) return until < today
  if (event.allDay) return false
  const end = event.end ?? (event.until === undefined ? event.time : undefined)
  return end !== undefined && minutesOf(end) <= nowMinute
}

/**
 * All-day rows first, then the rest by the minute they start the day at — a range carried over
 * from an earlier day has started at midnight — then by name.
 */
function compareRows(a: AgendaRow, b: AgendaRow): number {
  return (
    startMinute(a) - startMinute(b) ||
    a.event.title.localeCompare(b.event.title) ||
    a.event.id.localeCompare(b.event.id)
  )
}

function startMinute({ time }: AgendaRow): number {
  return time.kind === 'all-day' ? -1 : time.kind === 'until' ? 0 : minutesOf(time.start)
}

function nowBeforeIn(rows: AgendaRow[], nowMinute: number): number | null {
  if (!rows.some(({ time }) => time.kind !== 'all-day')) return null
  const next = rows.findIndex((row) => startMinute(row) > nowMinute)
  return next === -1 ? rows.length : next
}
