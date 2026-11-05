/* What a drag in the calendar carries, and where it lands for a slot under the pointer. Pure,
 * so `useCalendarDrag` is left with the browser's drag and drop and reading the pointer.
 */

import type { CalendarEvent, CalendarSlot } from '@renderer/types'
import { addDays, daysBetween } from './calendar'
import { movedPlacement, resizedPlacement, type TimedPlacement } from './time-grid'

export type CalendarGrab =
  /** A bar spans several days, and the day of it held is the one that lands where it is dropped. */
  | { at: 'day'; date: string }
  /** A box in the hour grid, in `date`'s column: `held` is how many minutes below its start, as it is `drawn`. */
  | { at: 'time'; date: string; held: number; drawn: TimedPlacement }

export type CalendarDragged =
  | { kind: 'move'; event: CalendarEvent; grab: CalendarGrab }
  /** Pulling the end of a box in `date`'s column of the hour grid. */
  | { kind: 'resize'; event: CalendarEvent; date: string; drawn: TimedPlacement }

/** What a drop asks for: where the object now starts, or for a resize where it now ends. */
export interface CalendarDropEdit {
  kind: 'move' | 'resize'
  slot: CalendarSlot
}

/** Whether a month cell or a day of the all-day band takes it: bars, by the day. */
export function takesByDay(dragged: CalendarDragged): boolean {
  return dragged.kind === 'move' && dragged.grab.at === 'day'
}

/** Whether a column of the hour grid takes it: boxes, by the minute. */
export function takesByTime(dragged: CalendarDragged): boolean {
  return dragged.kind === 'resize' || dragged.grab.at === 'time'
}

/**
 * Where a drag in the hour grid lands with the pointer at `slot`: a move on the day under the
 * pointer, a resize on its own. Null for a drag the hour grid does not take.
 */
export function timedLanding(
  dragged: CalendarDragged | null,
  slot: CalendarSlot | null,
): ({ date: string } & TimedPlacement) | null {
  if (!dragged || slot?.minute == null) return null
  if (dragged.kind === 'resize') {
    return { date: dragged.date, ...resizedPlacement(dragged.drawn.startMinute, slot.minute) }
  }
  if (dragged.grab.at !== 'time') return null
  return { date: slot.date, ...movedPlacement(dragged.grab.drawn, dragged.grab.held, slot.minute) }
}

/** The edit a drop at `slot` asks for; null where it would leave the object where it is. */
export function dropEdit(dragged: CalendarDragged, slot: CalendarSlot): CalendarDropEdit | null {
  if (dragged.kind === 'move' && dragged.grab.at === 'day') {
    const delta = daysBetween(dragged.grab.date, slot.date)
    return delta === 0 ? null : { kind: 'move', slot: { date: addDays(dragged.event.date, delta), minute: null } }
  }
  const landed = timedLanding(dragged, slot)
  if (!landed) return null
  if (dragged.kind === 'resize') {
    return landed.endMinute === dragged.drawn.endMinute
      ? null
      : { kind: 'resize', slot: { date: landed.date, minute: landed.endMinute } }
  }
  const { grab } = dragged
  const stays = grab.at === 'time' && landed.date === grab.date && landed.startMinute === grab.drawn.startMinute
  return stays ? null : { kind: 'move', slot: { date: landed.date, minute: landed.startMinute } }
}

/**
 * Whether the pointer at `a` and at `b` lands the drag in the same place: in the hour grid a
 * slot is read to the minute, but only a quarter hour moves where the drag lands.
 */
export function sameLanding(dragged: CalendarDragged | null, a: CalendarSlot | null, b: CalendarSlot | null): boolean {
  if (a === null || b === null) return a === b
  const landedA = timedLanding(dragged, a)
  const landedB = timedLanding(dragged, b)
  if (landedA && landedB) {
    return (
      landedA.date === landedB.date &&
      landedA.startMinute === landedB.startMinute &&
      landedA.endMinute === landedB.endMinute
    )
  }
  return a.date === b.date && a.minute === b.minute
}

/** Which of `count` equal columns, side by side across `width` pixels, is `offset` pixels in. */
export function columnAt(offset: number, width: number, count: number): number {
  return Math.min(Math.max(Math.floor((offset / width) * count), 0), count - 1)
}
