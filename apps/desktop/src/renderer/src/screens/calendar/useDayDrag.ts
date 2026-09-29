import { useState, type DragEvent } from 'react'
import type { CalendarEvent } from '@renderer/types'
import { addDays, daysBetween } from '@renderer/lib/calendar'

export interface DayDrag {
  /** The event being dragged, so its bar can be drawn as lifted. */
  draggingId: string | null
  /** The day the pointer is over, to mark it as where the drop lands. */
  overDate: string | null
  /**
   * Starts dragging `event`, held by the day `grabDate` (`YYYY-MM-DD`) of its bar: a bar spans
   * several days, and it is that day which lands on the one it is dropped on.
   */
  start: (event: CalendarEvent, grabDate: string, drag: DragEvent) => void
  end: () => void
  /** What a day's cell spreads on itself to take a drop. */
  targetFor: (date: string) => {
    onDragOver: (drag: DragEvent) => void
    onDrop: (drag: DragEvent) => void
  }
}

/**
 * Moving objects by whole days, by native drag and drop: bars in the month grid and in the
 * week's all-day band. `onMove` is given the date the event's first day lands on.
 */
export function useDayDrag(onMove: (event: CalendarEvent, date: string) => void): DayDrag {
  const [dragging, setDragging] = useState<{ event: CalendarEvent; grabDate: string } | null>(null)
  const [overDate, setOverDate] = useState<string | null>(null)

  const end = (): void => {
    setDragging(null)
    setOverDate(null)
  }

  return {
    draggingId: dragging?.event.id ?? null,
    overDate,
    start: (event, grabDate, drag) => {
      drag.dataTransfer.effectAllowed = 'move'
      // Chromium starts no drag without some data.
      drag.dataTransfer.setData('text/plain', event.title)
      setDragging({ event, grabDate })
    },
    end,
    targetFor: (date) => ({
      onDragOver: (drag) => {
        if (!dragging) return
        drag.preventDefault()
        drag.dataTransfer.dropEffect = 'move'
        if (overDate !== date) setOverDate(date)
      },
      onDrop: (drag) => {
        if (!dragging) return
        drag.preventDefault()
        const delta = daysBetween(dragging.grabDate, date)
        if (delta !== 0) onMove(dragging.event, addDays(dragging.event.date, delta))
        end()
      }
    })
  }
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
