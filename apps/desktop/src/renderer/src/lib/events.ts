/* The only renderer module that reads the shape of an events snapshot; components get view
 * models. Instants become dates and times of the machine's time zone, the one main placed
 * the span in. */

import {
  DEFAULT_EVENTS_DURATION_MINUTES,
  eventsSourceHasEnd,
  sameEventsSpan,
  shownEventsSpan,
  type EventsDatedObject,
  type EventsDetail,
  type EventsReschedule,
  type EventsSlot,
  type EventsSpan,
  type EventsSpanResult
} from '@anytype-calendar/events/domain'
import type { EventsCreateRequest, EventsRescheduleRequest, EventsSnapshot } from '@shared/ipc'
import type {
  CalendarEvent,
  CalendarMonth,
  CalendarSlot,
  CalendarView,
  EventDetail,
  ObjectType,
  SyncView
} from '@renderer/types'
import { addDays, buildWeek, isoDate } from './calendar'
import { anytypeTypeKeyOf, elapsedSince, hueOf, objectTypeKey, querySourceKey } from './schema'
import { minutesOf } from './time-grid'

const MINUTES_PER_DAY = 1440

/** The span main holds, or before any load the one `now` (epoch milliseconds) opens on. */
export function shownSpanFor(snapshot: EventsSnapshot, view: CalendarView, now: number): EventsSpan {
  return shownEventsSpan(snapshot) ?? spanFor(view, localDate(now), 0)
}

/** `instant` is epoch milliseconds. */
export function monthOf(instant: number): CalendarMonth {
  const date = new Date(instant)
  return { year: date.getFullYear(), month: date.getMonth() }
}

/** The first and last day, `YYYY-MM-DD`, that the span draws as its own: not a month's padding days. */
export function spanDays(span: EventsSpan): { first: string; last: string } {
  const first = anchorOf(span)
  if (span.kind === 'month') {
    return { first, last: isoDate(span.year, span.month, new Date(span.year, span.month + 1, 0).getDate()) }
  }
  return { first, last: span.kind === 'week' ? addDays(first, 6) : first }
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
 * does not count, so the grid never draws one span's events on another. An object brought by
 * several sources is several events here: `visibleEvents` picks the one to draw.
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

/**
 * Moves `event` to start at `slot`, keeping how long it lasts. A slot with no minute, e.g. a
 * month cell, keeps the time of day of a timed event.
 */
export function moveRequestFor(event: CalendarEvent, slot: CalendarSlot): EventsRescheduleRequest {
  return rescheduleRequestFor(event, { kind: 'move', start: eventsSlotOf(slot) })
}

/** Pulls the end of `event` to `slot`, keeping where it starts. */
export function resizeRequestFor(event: CalendarEvent, slot: CalendarSlot): EventsRescheduleRequest {
  return rescheduleRequestFor(event, { kind: 'resize', end: eventsSlotOf(slot) })
}

/**
 * Moves `event` to start on `date`, keeping how long it lasts: at `time` (`HH:MM`), or where
 * none is given at the time of day it had.
 */
export function startRequestFor(event: CalendarEvent, date: string, time?: string): EventsRescheduleRequest {
  return moveRequestFor(event, { date, minute: time === undefined ? null : minutesOf(time) })
}

/** Sets the end of `event` to `date`, at `time` where given and otherwise the time of day it had. */
export function endRequestFor(event: CalendarEvent, date: string, time?: string): EventsRescheduleRequest {
  return resizeRequestFor(event, { date, minute: time === undefined ? null : minutesOf(time) })
}

/** Gives `event` an end: an hour after its start when it is timed, its start's day when it is not. */
export function addEndRequestFor(event: CalendarEvent): EventsRescheduleRequest {
  if (event.allDay || event.time === undefined) return resizeRequestFor(event, { date: event.date, minute: null })
  const minute = minutesOf(event.time) + DEFAULT_EVENTS_DURATION_MINUTES
  return resizeRequestFor(event, {
    date: addDays(event.date, Math.floor(minute / MINUTES_PER_DAY)),
    minute: minute % MINUTES_PER_DAY
  })
}

export function clearEndRequestFor(event: CalendarEvent): EventsRescheduleRequest {
  return rescheduleRequestFor(event, { kind: 'clear-end' })
}

/** Whether the type's objects have an end of their own to add or remove: a To apart from their From. */
export function hasOwnEnd(type: ObjectType): boolean {
  return eventsSourceHasEnd(type)
}

/** `type` is one of the calendar's types, never a query: a query has no type of its own to create. */
export function createRequestFor(type: ObjectType, name: string, slot: CalendarSlot): EventsCreateRequest {
  return { spaceId: type.space, typeKey: anytypeTypeKeyOf(type), name, at: eventsSlotOf(slot) }
}

function rescheduleRequestFor(event: CalendarEvent, change: EventsReschedule): EventsRescheduleRequest {
  return { spaceId: event.space, id: event.id, change }
}

function eventsSlotOf({ date, minute }: CalendarSlot): EventsSlot {
  const [year, month = 1, day = 1] = date.split('-').map(Number)
  return { day: { year, month: month - 1, day }, minute }
}

function resultFor(snapshot: EventsSnapshot, span: EventsSpan): EventsSpanResult | undefined {
  const last = snapshot.phase === 'idle' ? undefined : snapshot.last
  return last && sameEventsSpan(last.span, span) ? last : undefined
}

/** An empty title (Anytype's own "Untitled" case) is resolved to text at each render site. */
function calendarEventFor({
  id,
  spaceId,
  source,
  rank,
  title,
  start,
  end,
  allDay,
  done,
  location,
  colour,
  details
}: EventsDatedObject): CalendarEvent {
  return {
    id,
    title,
    type:
      source.kind === 'type'
        ? objectTypeKey(spaceId, source.typeKey)
        : querySourceKey(spaceId, source.queryId),
    space: spaceId,
    rank,
    date: localDate(start),
    allDay,
    ...(allDay ? {} : { time: localTime(start) }),
    ...(end === null ? {} : { until: localDate(end), ...(allDay ? {} : { end: localTime(end) }) }),
    ...(done === undefined ? {} : { done }),
    ...(location === undefined ? {} : { location }),
    ...(colour === undefined ? {} : { category: hueOf(colour) }),
    details: details.map(eventDetailFor)
  }
}

/** A URL, address or number that cannot be opened as a link is drawn as text. */
function eventDetailFor(detail: EventsDetail): EventDetail {
  const { key } = detail
  switch (detail.format) {
    case 'number':
      return { key, kind: 'number', value: detail.value }
    case 'select':
    case 'multi_select':
      return {
        key,
        kind: 'options',
        options: detail.options.map(({ name, color }) => ({ name, category: hueOf(color) }))
      }
    case 'objects':
      return { key, kind: 'objects', objects: detail.objects.map(({ id, name, member }) => ({ id, name, member })) }
    case 'text':
      return { key, kind: 'text', text: detail.value }
    default: {
      const href = linkFor(detail.format, detail.value)
      return href === null ? { key, kind: 'text', text: detail.value } : { key, kind: 'link', text: detail.value, href }
    }
  }
}

/** A URL with no scheme (`example.com/jobs`) is taken for a web page, as a browser would. */
function linkFor(format: 'url' | 'email' | 'phone', value: string): string | null {
  const trimmed = value.trim()
  if (format === 'email') return trimmed.includes('@') ? `mailto:${trimmed}` : null
  if (format === 'phone') {
    const number = trimmed.replace(/[\s().-]/g, '')
    return /^\+?\d+$/.test(number) ? `tel:${number}` : null
  }
  const web = (text: string): string | null => {
    try {
      const url = new URL(text)
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
    } catch {
      return null
    }
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return web(trimmed)
  return trimmed.includes('.') && !/\s/.test(trimmed) ? web(`https://${trimmed}`) : null
}
