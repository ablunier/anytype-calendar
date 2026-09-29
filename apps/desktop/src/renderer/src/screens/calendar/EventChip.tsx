import type { CSSProperties, DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { CategoryHue } from '@renderer/types'
import type { EventSegment } from '@renderer/lib/month-layout'
import { catBg, catBgSoft, catText } from '@renderer/components/ui'
import { useTimeFormatValue } from '@renderer/hooks/TimeFormatContext'
import { formatTime } from '@renderer/lib/calendar'

export interface EventChipProps {
  segment: EventSegment
  title: string
  category: CategoryHue
  time?: string
  allDay?: boolean
  done?: boolean
  /** Given where it can be dragged to another day; left off where it cannot. */
  onDragStart?: (drag: DragEvent) => void
  onDragEnd?: () => void
  /** Being dragged: drawn faint, so the day it lands on shows through. */
  lifted?: boolean
  onClick: () => void
}

/**
 * A real <button>, not the design's role="button" div, so it is tabbable and fires on
 * Enter and Space. Stops propagation so opening an event does not also select the day.
 *
 * It is positioned over its week row, which is what lets it run past the day it sits in. A
 * side the range continues past is squared off and runs flush into the column's edge; a side
 * where the range really starts or ends keeps the chip radius and its inset.
 */
export function EventChip({
  segment,
  title,
  category,
  time,
  allDay = false,
  done = false,
  onDragStart,
  onDragEnd,
  lifted = false,
  onClick
}: EventChipProps): React.JSX.Element {
  const { i18n } = useTranslation()
  const timeFormat = useTimeFormatValue()
  const { column, span, lane, continuesBefore, continuesAfter } = segment

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      // A double-click on a bar is two clicks on it, not a double-click on the day to create.
      onDoubleClick={(event) => event.stopPropagation()}
      draggable={onDragStart !== undefined}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{ '--column': column, '--span': span, '--lane': lane } as CSSProperties}
      className={[
        'event-span flex min-h-20 items-center gap-6 border border-transparent px-6 py-2',
        'text-left transition-shadow duration-fast ease-standard hover:shadow-1',
        continuesBefore ? 'event-span-open-start' : 'rounded-l-chip',
        continuesAfter ? 'event-span-open-end' : 'rounded-r-chip',
        allDay ? `${catBg[category]} text-stone-000` : `${catBgSoft[category]} ${catText[category]}`,
        lifted ? 'opacity-40' : done ? 'opacity-55' : '',
        onDragStart ? 'cursor-grab' : ''
      ].join(' ')}
    >
      {!allDay ? (
        <span aria-hidden className={['size-5 shrink-0 rounded-pill', catBg[category]].join(' ')} />
      ) : null}
      {time ? (
        <span className="font-mono text-micro tracking-mono opacity-85">
          {formatTime(time, timeFormat, i18n.language)}
        </span>
      ) : null}
      <span
        className={[
          'min-w-0 flex-1 truncate type-ui text-tiny',
          done ? 'line-through' : ''
        ].join(' ')}
      >
        {title}
      </span>
    </button>
  )
}
