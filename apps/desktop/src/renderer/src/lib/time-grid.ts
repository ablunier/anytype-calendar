/* Where a day's timed objects sit in an hour grid: the minutes each one covers, and the
 * column it takes among the ones it overlaps.
 *
 * Pure helpers over local `YYYY-MM-DD` dates and `HH:MM` times, which compare in order as
 * strings. Objects that cover whole days are not laid out here — `splitDayEvents` sends them
 * to the all-day band, which `month-layout.ts` lays out instead.
 */

import type { CalendarEvent } from '@renderer/types'

export const MINUTES_PER_DAY = 1440

/** Below this a box would be too flat to read or to click, so it is drawn this tall anyway. */
export const MIN_SLOT_MINUTES = 30

/** What a drag in the time grid rounds to. */
export const SNAP_MINUTES = 15

/**
 * The last a dragged object may end at: midnight would make it end on the next day, sending
 * it from the grid to the all-day band.
 */
const LAST_END_MINUTE = MINUTES_PER_DAY - SNAP_MINUTES

export interface TimedSegment {
  event: CalendarEvent
  /** Minutes from the day's midnight, clamped to it. */
  startMinute: number
  /** Exclusive, and never less than `startMinute + MIN_SLOT_MINUTES`. */
  endMinute: number
  /** Its column among the objects it overlaps, and how many columns that group needs. */
  column: number
  columns: number
}

/**
 * The band takes what an hour grid cannot place: all-day objects, and timed ranges that run
 * past midnight, which belong to several days at once and read better as one bar across them.
 */
export function splitDayEvents(
  events: CalendarEvent[],
  date: string
): { band: CalendarEvent[]; timed: CalendarEvent[] } {
  const band: CalendarEvent[] = []
  const timed: CalendarEvent[] = []
  for (const event of events) {
    const covers = event.date <= date && date <= (event.until ?? event.date)
    if (!covers) continue
    const oneDay = (event.until ?? event.date) === event.date
    if (event.allDay || !oneDay || event.time === undefined) band.push(event)
    else timed.push(event)
  }
  return { band, timed }
}

/** The order columns are handed out in: earliest first, and the longer of two that start together. */
function byStartThenLength(a: TimedSegment, b: TimedSegment): number {
  return (
    a.startMinute - b.startMinute ||
    b.endMinute - a.endMinute ||
    a.event.title.localeCompare(b.event.title) ||
    a.event.id.localeCompare(b.event.id)
  )
}

/**
 * `timed` is one day's timed objects, as `splitDayEvents` returns them. Objects that overlap
 * share the day's width: each takes the leftmost free column, and everything in a run of
 * transitively overlapping objects is drawn the same width, so a column never shifts under a
 * neighbour that starts later.
 */
export function layOutDayColumn(timed: CalendarEvent[]): TimedSegment[] {
  const segments = timed
    .map((event) => {
      const startMinute = minutesOf(event.time)
      /* Everything here starts and ends on the one day — `splitDayEvents` sent the rest to
       * the band — so an object with no To date is a moment, drawn at the minimum height,
       * not something running on to midnight. */
      const endMinute = event.end === undefined ? startMinute : minutesOf(event.end)
      return {
        event,
        startMinute,
        endMinute: Math.min(MINUTES_PER_DAY, Math.max(endMinute, startMinute + MIN_SLOT_MINUTES)),
        column: 0,
        columns: 1
      }
    })
    .sort(byStartThenLength)

  const placed: TimedSegment[] = []
  // One run of objects that overlap directly or through each other, sized together at its end.
  let cluster: TimedSegment[] = []
  let clusterEnd = -1

  const closeCluster = (): void => {
    const columns = cluster.reduce((widest, segment) => Math.max(widest, segment.column + 1), 1)
    for (const segment of cluster) placed.push({ ...segment, columns })
    cluster = []
  }

  for (const segment of segments) {
    if (segment.startMinute >= clusterEnd) closeCluster()
    const taken = new Set(
      cluster.filter((other) => other.endMinute > segment.startMinute).map((other) => other.column)
    )
    let column = 0
    while (taken.has(column)) column++
    cluster.push({ ...segment, column })
    clusterEnd = Math.max(clusterEnd, segment.endMinute)
  }
  closeCluster()

  return placed
}

export interface TimedDrag {
  /** `move` keeps its length; `resize` pulls its end and keeps its start. */
  mode: 'move' | 'resize'
  /** Where it was drawn when the drag began: its column among the view's days, and its minutes. */
  dayIndex: number
  startMinute: number
  endMinute: number
  /** How far the pointer has gone, in minutes down the day and columns across. */
  minutes: number
  days: number
  dayCount: number
}

/**
 * Where a dragged object lands, snapped to the grid's quarter hours and kept on the view's
 * days. A move keeps how long it is drawn; a resize never ends before a quarter hour past its
 * start, nor at midnight.
 */
export function draggedPlacement({
  mode,
  dayIndex,
  startMinute,
  endMinute,
  minutes,
  days,
  dayCount
}: TimedDrag): { dayIndex: number; startMinute: number; endMinute: number } {
  if (mode === 'resize') {
    const end = Math.max(Math.min(snap(endMinute + minutes), LAST_END_MINUTE), startMinute + SNAP_MINUTES)
    return { dayIndex, startMinute, endMinute: end }
  }
  const length = endMinute - startMinute
  const start = Math.min(Math.max(snap(startMinute + minutes), 0), LAST_END_MINUTE)
  return {
    dayIndex: Math.min(Math.max(dayIndex + days, 0), dayCount - 1),
    startMinute: start,
    endMinute: Math.min(start + length, MINUTES_PER_DAY)
  }
}

/** Minutes from midnight to `HH:MM`. */
export function timeOfMinute(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

function snap(minute: number): number {
  return Math.round(minute / SNAP_MINUTES) * SNAP_MINUTES
}

/** `HH:MM` to minutes from midnight; an absent time is midnight. */
export function minutesOf(time: string | undefined): number {
  if (time === undefined) return 0
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * 60 + minutes
}
