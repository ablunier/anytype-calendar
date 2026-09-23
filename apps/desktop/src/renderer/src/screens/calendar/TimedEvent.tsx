import type { CSSProperties } from 'react'
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
  done?: boolean
  onClick: () => void
}

/**
 * A real <button>, like EventChip, so it is tabbable and fires on Enter and Space. It is
 * placed over the day's canvas by the minutes it covers, so its height is its duration.
 */
export function TimedEvent({
  segment,
  title,
  category,
  done = false,
  onClick
}: TimedEventProps): React.JSX.Element {
  const { i18n } = useTranslation()
  const timeFormat = useTimeFormatValue()
  const { event, startMinute, endMinute, column, columns } = segment
  const stacked = endMinute - startMinute >= STACKED_MINUTES

  return (
    <button
      type="button"
      onClick={(clicked) => {
        clicked.stopPropagation()
        onClick()
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
        done ? 'opacity-55' : ''
      ].join(' ')}
    >
      <span className="shrink-0 font-mono text-micro tracking-mono opacity-85">
        {event.time ? formatTime(event.time, timeFormat, i18n.language) : null}
      </span>
      <span className={['min-w-0 truncate type-ui text-tiny', done ? 'line-through' : ''].join(' ')}>
        {title}
      </span>
    </button>
  )
}