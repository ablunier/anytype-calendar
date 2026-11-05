import { addDays } from '@renderer/lib/calendar'
import {
  type CalendarDragged,
  columnAt,
  dropEdit,
  sameLanding,
  takesByDay,
  takesByTime,
} from '@renderer/lib/calendar-drag'
import { minuteAt } from '@renderer/lib/time-grid'
import type { CalendarEvent, CalendarSlot } from '@renderer/types'
import { type DragEvent, useState } from 'react'

/**
 * The app's own type rather than `text/plain`: Chromium starts no drag without some data, and
 * a text field would paste plain text dropped on it. What is dragged stays in React state.
 */
const DRAG_TYPE = 'application/x-anytype-calendar'

/* The hour grid's ghost bar is its preview, so its drags show no image of their own. Made
 * ahead of any drag: an image that has not loaded by `dragstart` is not used. */
const NO_IMAGE = new Image()
NO_IMAGE.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

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
  /** What a month cell spreads on itself: it takes bars, by the day. */
  dayTarget: (date: string) => CalendarDropTarget
  /**
   * What a row of equal day columns spreads on itself, such as the all-day band: it takes bars,
   * by the column under the pointer, so a bar drawn over the row takes the drop too.
   */
  rowTarget: (dates: string[]) => CalendarDropTarget
  /**
   * What a day's column of the hour grid spreads on its 24-hour canvas: it takes boxes, by the
   * minute under the pointer. Spread on the element the boxes are drawn in, so the pointer over
   * one is over the column too.
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
    const edit = dropEdit(landed, slot)
    if (edit?.kind === 'move') onMove(landed.event, edit.slot)
    else if (edit?.kind === 'resize') onResize(landed.event, edit.slot)
  }

  const target = (
    takes: (candidate: CalendarDragged) => boolean,
    locate: (drag: DragEvent) => CalendarSlot,
  ): CalendarDropTarget => ({
    onDragOver: (drag) => {
      if (!dragged || !takes(dragged)) return
      drag.preventDefault()
      drag.dataTransfer.dropEffect = 'move'
      // Redrawn only when where it lands moves: the screen holds this state, not the grid.
      const slot = locate(drag)
      if (!sameLanding(dragged, over, slot)) setOver(slot)
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
    },
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
    dayTarget: (date) => target(takesByDay, () => ({ date, minute: null })),
    rowTarget: (dates) =>
      target(takesByDay, (drag) => {
        const { left, width } = drag.currentTarget.getBoundingClientRect()
        return { date: dates[columnAt(drag.clientX - left, width, dates.length)] ?? '', minute: null }
      }),
    timeTarget: (date) =>
      target(takesByTime, (drag) => {
        const { top, height } = drag.currentTarget.getBoundingClientRect()
        return { date, minute: Math.round(minuteAt(drag.clientY - top, height)) }
      }),
  }
}

/**
 * The day of a bar the pointer holds it by: bars are positioned over their row, spanning
 * `span` equal columns from the one their segment starts on.
 */
export function grabbedDate(drag: DragEvent, firstDate: string, span: number): string {
  const { left, width } = drag.currentTarget.getBoundingClientRect()
  return addDays(firstDate, columnAt(drag.clientX - left, width, span))
}
