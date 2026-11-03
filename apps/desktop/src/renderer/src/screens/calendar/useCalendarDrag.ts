import { useState, type DragEvent } from 'react'
import type { CalendarEvent, CalendarSlot } from '@renderer/types'
import { addDays, daysBetween } from '@renderer/lib/calendar'
import { minuteAt, movedPlacement, resizedPlacement, type TimedPlacement } from '@renderer/lib/time-grid'

/**
 * The app's own type rather than `text/plain`: Chromium starts no drag without some data, and
 * a text field would paste plain text dropped on it. What is dragged stays in React state.
 */
const DRAG_TYPE = 'application/x-anytype-calendar'

/* The hour grid's ghost bar is its preview, so its drags show no image of their own. Made
 * ahead of any drag: an image that has not loaded by `dragstart` is not used. */
const NO_IMAGE = new Image()
NO_IMAGE.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

export type CalendarGrab =
  /** A bar spans several days, and the day of it held is the one that lands where it is dropped. */
  | { at: 'day'; date: string }
  /** A box in the hour grid: `held` is how many minutes below its start, as it is `drawn`. */
  | { at: 'time'; held: number; drawn: TimedPlacement }

export type CalendarDragged =
  | { kind: 'move'; event: CalendarEvent; grab: CalendarGrab }
  /** Pulling the end of a box in the hour grid. */
  | { kind: 'resize'; event: CalendarEvent; drawn: TimedPlacement }

export interface CalendarDropTarget {
  onDragOver: (drag: DragEvent) => void
  onDragLeave: (drag: DragEvent) => void
  onDrop: (drag: DragEvent) => void
}

export interface CalendarDrag {
  dragged: CalendarDragged | null
  /** The event being dragged, so it can be drawn as lifted. */
  draggingId: string | null
  /** The slot under the pointer, while it is over a target that takes the drag. */
  over: CalendarSlot | null
  /** The day under the pointer, while it is over a day target, to mark where the drop lands. */
  overDate: string | null
  start: (dragged: CalendarDragged, drag: DragEvent) => void
  end: () => void
  /** What a month cell or a day of the all-day band spreads on itself: it takes bars, by the day. */
  dayTarget: (date: string) => CalendarDropTarget
  /**
   * What a day's column of the hour grid spreads on its 24-hour canvas: it takes boxes, by the
   * minute under the pointer.
   */
  timeTarget: (date: string) => CalendarDropTarget
}

export interface CalendarDragActions {
  /** `slot` is where it now starts. */
  onMove: (event: CalendarEvent, slot: CalendarSlot) => void
  /** `slot` is where it now ends. */
  onResize: (event: CalendarEvent, slot: CalendarSlot) => void
}

/**
 * Every drag of the calendar, by native drag and drop: the browser starts it, ends it, and
 * cancels it on Escape or a drop on nothing that takes it. Held by the screen rather than by a
 * grid, so a drag can start outside the grid it lands on.
 */
export function useCalendarDrag({ onMove, onResize }: CalendarDragActions): CalendarDrag {
  const [dragged, setDragged] = useState<CalendarDragged | null>(null)
  const [over, setOver] = useState<CalendarSlot | null>(null)

  const end = (): void => {
    setDragged(null)
    setOver(null)
  }

  const land = (landed: CalendarDragged, slot: CalendarSlot): void => {
    const { event } = landed
    const placed = timedLanding(landed, slot)
    if (landed.kind === 'resize') {
      if (placed && placed.endMinute !== landed.drawn.endMinute) {
        onResize(event, { date: placed.date, minute: placed.endMinute })
      }
    } else if (landed.grab.at === 'day') {
      const delta = daysBetween(landed.grab.date, slot.date)
      if (delta !== 0) onMove(event, { date: addDays(event.date, delta), minute: null })
    } else if (placed && (placed.startMinute !== landed.grab.drawn.startMinute || placed.date !== event.date)) {
      onMove(event, { date: placed.date, minute: placed.startMinute })
    }
  }

  const target = (
    takes: (candidate: CalendarDragged) => boolean,
    locate: (drag: DragEvent) => CalendarSlot
  ): CalendarDropTarget => ({
    onDragOver: (drag) => {
      if (!dragged || !takes(dragged)) return
      drag.preventDefault()
      drag.dataTransfer.dropEffect = 'move'
      const slot = locate(drag)
      if (slot.date !== over?.date || slot.minute !== over.minute) setOver(slot)
    },
    onDragLeave: (drag) => {
      // Leaving for one of its own children is not leaving it.
      if (!drag.currentTarget.contains(drag.relatedTarget as Node | null)) setOver(null)
    },
    onDrop: (drag) => {
      if (!dragged || !takes(dragged)) return
      drag.preventDefault()
      land(dragged, locate(drag))
      // The source may be gone by now, moved by the edit, and fire no `dragend` of its own.
      end()
    }
  })

  return {
    dragged,
    draggingId: dragged?.event.id ?? null,
    over,
    overDate: over?.minute === null ? over.date : null,
    start: (next, drag) => {
      drag.dataTransfer.effectAllowed = 'move'
      drag.dataTransfer.setData(DRAG_TYPE, next.event.id)
      if (next.kind === 'resize' || next.grab.at === 'time') drag.dataTransfer.setDragImage(NO_IMAGE, 0, 0)
      setDragged(next)
    },
    end,
    dayTarget: (date) =>
      target(
        (candidate) => candidate.kind === 'move' && candidate.grab.at === 'day',
        () => ({ date, minute: null })
      ),
    timeTarget: (date) =>
      target(
        (candidate) => candidate.kind === 'resize' || candidate.grab.at === 'time',
        (drag) => {
          const { top, height } = drag.currentTarget.getBoundingClientRect()
          return { date, minute: Math.round(minuteAt(drag.clientY - top, height)) }
        }
      )
  }
}

/**
 * Where a drag in the hour grid lands with the pointer at `slot`: a move on the day under the
 * pointer, a resize on its own day. Null for a drag the hour grid does not take.
 */
export function timedLanding(
  dragged: CalendarDragged | null,
  slot: CalendarSlot | null
): ({ date: string } & TimedPlacement) | null {
  if (!dragged || slot?.minute == null) return null
  if (dragged.kind === 'resize') {
    return { date: dragged.event.date, ...resizedPlacement(dragged.drawn.startMinute, slot.minute) }
  }
  if (dragged.grab.at !== 'time') return null
  return { date: slot.date, ...movedPlacement(dragged.grab.drawn, dragged.grab.held, slot.minute) }
}

/**
 * The day of a bar the pointer holds it by: bars are positioned over their row, spanning
 * `span` equal columns from the one their segment starts on.
 */
export function grabbedDate(drag: DragEvent, firstDate: string, span: number): string {
  const { left, width } = drag.currentTarget.getBoundingClientRect()
  const column = Math.floor(((drag.clientX - left) / width) * span)
  return addDays(firstDate, Math.min(Math.max(column, 0), span - 1))
}
