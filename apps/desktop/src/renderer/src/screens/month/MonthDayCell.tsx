import type { KeyboardEvent } from 'react'
import type { CalendarEvent, MonthCell, ObjectType } from '@renderer/types'
import { EventChip } from './EventChip'

/** Chips beyond this are summarised as "+n more". */
const MAX_CHIPS = 3

export interface MonthDayCellProps {
  cell: MonthCell
  events: CalendarEvent[]
  typesByKey: Map<string, ObjectType>
  isoDate: string
  isToday: boolean
  isSelected: boolean
  isWeekend: boolean
  tabbable: boolean
  onFocus: () => void
  onSelect: () => void
  onKeyDown: (event: KeyboardEvent) => void
  onOpenEvent: (event: CalendarEvent) => void
}

/** One square of the month grid: the date, up to three chips, and an overflow count. */
export function MonthDayCell({
  cell,
  events,
  typesByKey,
  isoDate,
  isToday,
  isSelected,
  isWeekend,
  tabbable,
  onFocus,
  onSelect,
  onKeyDown,
  onOpenEvent
}: MonthDayCellProps): React.JSX.Element {
  const shown = events.slice(0, MAX_CHIPS)
  const overflow = events.length - shown.length

  /* Outside days belong to the adjacent month: shown for continuity, but not selectable
   * and not part of the roving tab order. */
  const interactive = !cell.outside

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
          dateTime={isoDate}
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

      <div className="flex flex-col gap-2">
        {shown.map((event) => {
          const type = typesByKey.get(event.type)
          const continued = event.until !== undefined && event.day !== cell.day
          return (
            <EventChip
              key={event.id}
              title={`${event.title}${continued ? ' (cont.)' : ''}`}
              category={type?.category ?? 'graphite'}
              time={event.time}
              allDay={event.allDay}
              done={event.done}
              onClick={() => onOpenEvent(event)}
            />
          )
        })}
      </div>

      {overflow > 0 ? (
        <span className="pl-2 type-caption text-micro text-ink-tertiary">+{overflow} more</span>
      ) : null}
    </div>
  )
}
