/* Where a week's objects are drawn: one segment per event per week, and the lane each
 * segment takes so a range keeps one vertical slot across every day it covers.
 *
 * Pure helpers over local `YYYY-MM-DD` dates, which compare in order as strings.
 */

import type { CalendarEvent, DayColumn } from '@renderer/types'

/** Past this many lanes a week's segments are dropped and counted as `hidden` instead. */
export const MAX_LANES = 3

export interface EventSegment {
  event: CalendarEvent
  /** Column 0-6 in the week. */
  column: number
  /** Columns covered, at least 1. */
  span: number
  lane: number
  /** The range starts before this segment, so the bar is cut at the column's leading edge. */
  continuesBefore: boolean
  continuesAfter: boolean
}

export interface WeekLayout {
  segments: EventSegment[]
  /** Lanes the week draws, so every cell reserves the same height. */
  lanes: number
  /** Events the lane cap dropped, per column. */
  hidden: number[]
}

/** The lane order: long bars take the top lanes, and ties resolve the same way every read. */
function byDrawingOrder(a: EventSegment, b: EventSegment): number {
  return (
    a.column - b.column ||
    b.span - a.span ||
    a.event.date.localeCompare(b.event.date) ||
    a.event.id.localeCompare(b.event.id)
  )
}

/**
 * `week` is seven consecutive days — a row of the month grid, or a week view's all-day band.
 * A month is read with a week of slack on each side, so the days a row borrows from the
 * adjacent months carry their objects too and a range crosses the edge unbroken.
 *
 * `maxLanes` is how many bars a row has room for; past it, segments are dropped and counted
 * in `hidden` instead.
 */
export function layOutWeek(
  events: CalendarEvent[],
  week: DayColumn[],
  maxLanes = MAX_LANES
): WeekLayout {
  const segments: EventSegment[] = []

  for (const event of events) {
    const start = event.date
    const end = event.until ?? event.date
    const covered = week.flatMap((cell, index) =>
      start <= cell.date && cell.date <= end ? [index] : []
    )
    const first = covered[0]
    const last = covered[covered.length - 1]
    if (first === undefined || last === undefined) continue

    segments.push({
      event,
      column: first,
      span: last - first + 1,
      lane: 0,
      continuesBefore: start < week[first].date,
      continuesAfter: end > week[last].date
    })
  }

  segments.sort(byDrawingOrder)

  const placed: EventSegment[] = []
  const hidden = week.map(() => 0)
  const taken: EventSegment[][] = []

  for (const segment of segments) {
    const overlaps = (other: EventSegment): boolean =>
      other.column < segment.column + segment.span && segment.column < other.column + other.span
    const lane = taken.findIndex((occupants) => !occupants.some(overlaps))

    if (lane === -1 && taken.length >= maxLanes) {
      for (let column = segment.column; column < segment.column + segment.span; column++) {
        hidden[column]++
      }
      continue
    }

    if (lane === -1) taken.push([])
    const index = lane === -1 ? taken.length - 1 : lane
    taken[index].push(segment)
    placed.push({ ...segment, lane: index })
  }

  return { segments: placed, lanes: taken.length, hidden }
}
