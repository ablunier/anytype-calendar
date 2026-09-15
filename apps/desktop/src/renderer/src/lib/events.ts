/* The only renderer module that reads the shape of an events snapshot; components get view
 * models. Instants become dates and times of the machine's time zone, the one main placed
 * the month in. */

import {
  sameEventsMonth,
  shownEventsMonth,
  type EventsDatedObject,
  type EventsMonthResult
} from '@anytype-calendar/events/domain'
import type { EventsSnapshot } from '@shared/ipc'
import type { CalendarEvent, CalendarMonth, SyncView } from '@renderer/types'
import { isoDate } from './calendar'
import { elapsedSince, objectTypeKey } from './schema'

/** The month main holds, or before any load the one `now` (epoch milliseconds) falls in. */
export function shownMonthFor(snapshot: EventsSnapshot, now: number): CalendarMonth {
  return shownEventsMonth(snapshot) ?? monthOf(now)
}

/** `instant` is epoch milliseconds. */
export function monthOf(instant: number): CalendarMonth {
  const date = new Date(instant)
  return { year: date.getFullYear(), month: date.getMonth() }
}

/**
 * The month's events, or null while it has not been read. A result kept from another month
 * does not count, so the grid never draws one month's events on another.
 */
export function eventsFor(snapshot: EventsSnapshot, month: CalendarMonth): CalendarEvent[] | null {
  return resultFor(snapshot, month)?.objects.map(calendarEventFor) ?? null
}

/** How the latest read of `month` went. `now` is epoch milliseconds. */
export function monthStatusFor(snapshot: EventsSnapshot, month: CalendarMonth, now: number): SyncView {
  const hasResult = resultFor(snapshot, month) !== undefined
  switch (snapshot.phase) {
    // Idle only until main starts the load it runs on every sign-in.
    case 'idle':
    case 'loading':
      return { state: 'syncing', hasResult }
    case 'loaded':
      return { state: 'synced', detail: elapsedSince(snapshot.last.loadedAt, now), hasResult }
    case 'failed':
      return {
        state: 'error',
        detail: snapshot.failure === 'unauthorized' ? 'Key not accepted' : 'Is Anytype running?',
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

function resultFor(snapshot: EventsSnapshot, month: CalendarMonth): EventsMonthResult | undefined {
  const last = snapshot.phase === 'idle' ? undefined : snapshot.last
  return last && sameEventsMonth(last.month, month) ? last : undefined
}

/** Anytype names an object with no title "Untitled", so the calendar does too. */
function calendarEventFor({
  id,
  spaceId,
  typeKey,
  title,
  start,
  end,
  allDay
}: EventsDatedObject): CalendarEvent {
  return {
    id,
    title: title === '' ? 'Untitled' : title,
    type: objectTypeKey(spaceId, typeKey),
    space: spaceId,
    date: localDate(start),
    allDay,
    ...(allDay ? {} : { time: localTime(start) }),
    ...(end === null ? {} : { until: localDate(end), ...(allDay ? {} : { end: localTime(end) }) })
  }
}
