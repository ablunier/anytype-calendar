/* The only renderer module that reads the shape of an events snapshot; components get view
 * models. Instants become dates and times of the machine's time zone, the one main placed
 * the span in. */

import {
  sameEventsSpan,
  shownEventsSpan,
  type EventsDatedObject,
  type EventsSpan,
  type EventsSpanResult
} from '@anytype-calendar/events/domain'
import type { EventsSnapshot } from '@shared/ipc'
import type { CalendarEvent, CalendarMonth, CalendarView, SyncView } from '@renderer/types'
import { addDays, buildWeek, isoDate } from './calendar'
import { elapsedSince, hueOf, objectTypeKey } from './schema'

/** The span main holds, or before any load the one `now` (epoch milliseconds) opens on. */
export function shownSpanFor(snapshot: EventsSnapshot, view: CalendarView, now: number): EventsSpan {
  return shownEventsSpan(snapshot) ?? spanFor(view, localDate(now), 0)
}

/** `instant` is epoch milliseconds. */
export function monthOf(instant: number): CalendarMonth {
  const date = new Date(instant)
  return { year: date.getFullYear(), month: date.getMonth() }
}

/** The span a view wants around `date` (`YYYY-MM-DD`), given the user's first day of the week. */
export function spanFor(view: CalendarView, date: string, weekStart: number): EventsSpan {
  const [year, month = 1, day = 1] = date.split('-').map(Number)
  switch (view) {
    case 'month':
      return { kind: 'month', year, month: month - 1 }
    case 'day':
      return { kind: 'day', start: { year, month: month - 1, day } }
    case 'week': {
      const first = buildWeek(date, weekStart)[0]?.date ?? date
      const [weekYear, weekMonth = 1, weekDay = 1] = first.split('-').map(Number)
      return { kind: 'week', start: { year: weekYear, month: weekMonth - 1, day: weekDay } }
    }
  }
}

/**
 * The date a span is anchored on, `YYYY-MM-DD`: the day a day view draws, the first day of a
 * week, or the first of a month. Navigation and the label are worked out from it.
 */
export function anchorOf(span: EventsSpan): string {
  return span.kind === 'month'
    ? isoDate(span.year, span.month, 1)
    : isoDate(span.start.year, span.start.month, span.start.day)
}

/**
 * The date another view should open on when the user switches to it. Today, when the span on
 * screen covers it — switching from September's month to the week view means this week, not
 * the week of the 1st — and otherwise the day the span is anchored on, so a user reading some
 * other month stays where they were looking.
 */
export function switchDateFor(span: EventsSpan, today: string): string {
  const anchor = anchorOf(span)
  const covers =
    span.kind === 'month'
      ? // Both are `YYYY-MM-DD`, so the same month is the same first seven characters.
        anchor.slice(0, 7) === today.slice(0, 7)
      : anchor <= today && today <= addDays(anchor, span.kind === 'week' ? 6 : 0)
  return covers ? today : anchor
}

/** The span one step on from this one, in its own units. */
export function shiftSpan(span: EventsSpan, delta: number): EventsSpan {
  if (span.kind === 'month') {
    const index = span.year * 12 + span.month + delta
    return { kind: 'month', year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 }
  }
  const moved = addDays(anchorOf(span), delta * (span.kind === 'week' ? 7 : 1))
  const [year, month = 1, day = 1] = moved.split('-').map(Number)
  return { kind: span.kind, start: { year, month: month - 1, day } }
}

/**
 * The span's events, or null while it has not been read. A result kept from another span
 * does not count, so the grid never draws one span's events on another.
 */
export function eventsFor(snapshot: EventsSnapshot, span: EventsSpan): CalendarEvent[] | null {
  return resultFor(snapshot, span)?.objects.map(calendarEventFor) ?? null
}

/** How the latest read of `span` went. `now` is epoch milliseconds. */
export function spanStatusFor(snapshot: EventsSnapshot, span: EventsSpan, now: number): SyncView {
  const hasResult = resultFor(snapshot, span) !== undefined
  switch (snapshot.phase) {
    // Idle only until main starts the load it runs on every sign-in.
    case 'idle':
    case 'loading':
      return { state: 'syncing', hasResult }
    case 'loaded':
      return {
        state: 'synced',
        detail: { kind: 'elapsed', elapsed: elapsedSince(snapshot.last.loadedAt, now) },
        hasResult
      }
    case 'failed':
      return {
        state: 'error',
        detail: { kind: snapshot.failure === 'unauthorized' ? 'unauthorized' : 'unreachable' },
        hasResult
      }
  }
}

/** `YYYY-MM-DD` in the machine's time zone. `instant` is epoch milliseconds. */
export function localDate(instant: number): string {
  const date = new Date(instant)
  return isoDate(date.getFullYear(), date.getMonth(), date.getDate())
}

/** `HH:MM` in the machine's time zone. `instant` is epoch milliseconds. */
export function localTime(instant: number): string {
  const date = new Date(instant)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function resultFor(snapshot: EventsSnapshot, span: EventsSpan): EventsSpanResult | undefined {
  const last = snapshot.phase === 'idle' ? undefined : snapshot.last
  return last && sameEventsSpan(last.span, span) ? last : undefined
}

/** An empty title (Anytype's own "Untitled" case) is resolved to text at each render site. */
function calendarEventFor({
  id,
  spaceId,
  typeKey,
  title,
  start,
  end,
  allDay,
  done,
  location,
  colour
}: EventsDatedObject): CalendarEvent {
  return {
    id,
    title,
    type: objectTypeKey(spaceId, typeKey),
    space: spaceId,
    date: localDate(start),
    allDay,
    ...(allDay ? {} : { time: localTime(start) }),
    ...(end === null ? {} : { until: localDate(end), ...(allDay ? {} : { end: localTime(end) }) }),
    ...(done === undefined ? {} : { done }),
    ...(location === undefined ? {} : { location }),
    ...(colour === undefined ? {} : { category: hueOf(colour) })
  }
}
