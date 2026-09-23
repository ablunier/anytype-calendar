import type { CSSProperties, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { CalendarEvent, MonthCell, ObjectType } from '@renderer/types'
import type { EventSegment } from '@renderer/lib/month-layout'
import { EventChip } from './EventChip'

export interface MonthDayCellProps {
  cell: MonthCell
  /** The week's segments that start in this cell; each may reach across the ones after it. */
  segments: EventSegment[]
  /** Lanes the whole week draws, so every cell of it reserves the same height. */
  lanes: number
  /** Events the week's lane cap dropped on this day. */
  hidden: number
  typesByKey: Map<string, ObjectType>
  isToday: boolean
  isSelected: boolean
  isWeekend: boolean
  tabbable: boolean
  onFocus: () => void
  onSelect: () => void
  onKeyDown: (event: KeyboardEvent) => void
  onOpenEvent: (event: CalendarEvent) => void
}

export function MonthDayCell({
  cell,
  segments,
  lanes,
  hidden,
  typesByKey,
  isToday,
  isSelected,
  isWeekend,
  tabbable,
  onFocus,
  onSelect,
  onKeyDown,
  onOpenEvent
}: MonthDayCellProps): React.JSX.Element {
  const { t } = useTranslation()
  /* Outside days belong to the adjacent month: they carry their objects, so a range crosses
   * the edge unbroken, but they are dimmed, not selectable, and not part of the roving tab
   * order — their day numbers repeat the month's own. */
  const interactive = !cell.outside

  /* The cell is deliberately left unpositioned: a bar has to reach across the columns after
   * this one, so it resolves against the week row. The lane stack reserves its height here. */
  return (
    <div
      role="gridcell"
      data-day={interactive ? cell.day : undefined}
      aria-selected={interactive ? isSelected : undefined}
      aria-current={isToday ? 'date' : undefined}
      tabIndex={tabbable ? 0 : -1}
      onClick={interactive ? onSelect : undefined}
      onFocus={interactive ? onFocus : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
      className={[
        'flex min-h-daycell flex-col gap-4 border-r border-b border-grid-line p-6',
        'transition-colors duration-fast ease-standard',
        interactive ? 'cursor-pointer' : '',
        isSelected
          ? 'bg-surface-selected'
          : isToday
            ? 'bg-today-wash'
            : cell.outside || isWeekend
              ? 'bg-surface-rail'
              : 'bg-surface-card'
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-4">
        <time
          dateTime={cell.date}
          className={[
            'inline-flex h-18 min-w-18 items-center justify-center rounded-4 px-4',
            'font-mono text-tiny tabular-nums',
            isToday
              ? 'bg-today-ink text-stone-000'
              : cell.outside
                ? 'text-ink-tertiary'
                : 'text-ink-secondary'
          ].join(' ')}
        >
          {cell.day}
        </time>
      </div>

      {lanes > 0 ? (
        <div className="lane-stack" style={{ '--lanes': lanes } as CSSProperties} />
      ) : null}

      {hidden > 0 ? (
        <span className="pl-2 type-caption text-micro text-ink-tertiary">
          {t('calendar.dayCell.hiddenMore', { count: hidden })}
        </span>
      ) : null}

      {segments.map((segment) => {
        const type = typesByKey.get(segment.event.type)
        return (
          <EventChip
            key={segment.event.id}
            segment={segment}
            title={segment.event.title || t('common.untitled')}
            category={type?.category ?? 'graphite'}
            time={segment.continuesBefore ? undefined : segment.event.time}
            allDay={segment.event.allDay}
            done={segment.event.done}
            onClick={() => onOpenEvent(segment.event)}
          />
        )
      })}
    </div>
  )
}
