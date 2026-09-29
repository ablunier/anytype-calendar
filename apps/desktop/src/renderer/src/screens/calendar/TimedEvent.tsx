import type { CSSProperties, PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { CategoryHue } from '@renderer/types'
import type { TimedSegment } from '@renderer/lib/time-grid'
import { catBgSoft, catBorder, catText } from '@renderer/components/ui'
import { useTimeFormatValue } from '@renderer/hooks/TimeFormatContext'
import { formatTime } from '@renderer/lib/calendar'

/** Under roughly half an hour there is only room for one line, so the title takes it. */
const STACKED_MINUTES = 45

export interface TimedEventProps {
  segment: TimedSegment
  title: string
  category: CategoryHue
  /** `HH:MM`; defaults to the event's own. */
  time?: string
  done?: boolean
  /**
   * Given where it can be dragged: by its body to move it, and by its bottom edge to resize
   * it, which `resizable` offers. Left off where it cannot.
   */
  onDragStart?: (pointer: PointerEvent, mode: 'move' | 'resize') => void
  resizable?: boolean
  /** Being dragged: drawn faint, where it was. */
  lifted?: boolean
  /** The drag's preview of where it lands: drawn raised, and not interactive. */
  preview?: boolean
  onClick: () => void
}

/**
 * A real <button>, like EventChip, so it is tabbable and fires on Enter and Space. It is
 * placed over the day's canvas by the minutes it covers, so its height is its duration.
 * TimeGrid drives any drag of it: this only says where one began.
 */
export function TimedEvent({
  segment,
  title,
  category,
  time,
  done = false,
  onDragStart,
  resizable = false,
  lifted = false,
  preview = false,
  onClick
}: TimedEventProps): React.JSX.Element {
  const { i18n } = useTranslation()
  const timeFormat = useTimeFormatValue()
  const { event, startMinute, endMinute, column, columns } = segment
  const stacked = endMinute - startMinute >= STACKED_MINUTES
  const shownTime = time ?? event.time

  return (
    <button
      type="button"
      tabIndex={preview ? -1 : undefined}
      aria-hidden={preview || undefined}
      onClick={(clicked) => {
        clicked.stopPropagation()
        onClick()
      }}
      onDoubleClick={(clicked) => clicked.stopPropagation()}
      onPointerDown={(pointer) => {
        if (onDragStart && pointer.button === 0) onDragStart(pointer, 'move')
      }}
      style={
        {
          '--start-minute': startMinute,
          '--end-minute': endMinute,
          '--column': column,
          '--columns': columns
        } as CSSProperties
      }
      className={[
        // The hue is carried at full strength by the left rule alone; the fill stays soft so
        // overlapping boxes remain readable.
        'time-slot overflow-hidden rounded-chip border-l-2 px-6 py-2 text-left',
        'transition-shadow duration-fast ease-standard hover:shadow-1',
        stacked ? 'flex flex-col gap-2' : 'flex items-baseline gap-6',
        catBgSoft[category],
        catText[category],
        catBorder[category],
        lifted ? 'opacity-40' : done ? 'opacity-55' : '',
        preview ? 'pointer-events-none z-10 shadow-2' : '',
        onDragStart ? 'cursor-grab touch-none' : ''
      ].join(' ')}
    >
      <span className="shrink-0 font-mono text-micro tracking-mono opacity-85">
        {shownTime ? formatTime(shownTime, timeFormat, i18n.language) : null}
      </span>
      <span className={['min-w-0 truncate type-ui text-tiny', done ? 'line-through' : ''].join(' ')}>
        {title}
      </span>
      {onDragStart && resizable ? (
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-6 cursor-ns-resize"
          onPointerDown={(pointer) => {
            if (pointer.button !== 0) return
            // The body's own handler would take it for a move.
            pointer.stopPropagation()
            onDragStart(pointer, 'resize')
          }}
        />
      ) : null}
    </button>
  )
}