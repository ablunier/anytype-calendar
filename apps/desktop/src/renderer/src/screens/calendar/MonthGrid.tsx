import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { CalendarEvent, MonthCell, ObjectType } from '@renderer/types'
import { isoWeekNumber, isWeekendColumn, weekdaysFrom } from '@renderer/lib/calendar'
import { layOutWeek } from '@renderer/lib/month-layout'
import { MonthDayCell } from './MonthDayCell'

export interface MonthGridProps {
  cells: MonthCell[]
  events: CalendarEvent[]
  typesByKey: Map<string, ObjectType>
  /** `YYYY-MM-DD`. */
  today: string
  showWeekNumbers: boolean
  /** Monday is 0, Sunday 6. */
  weekStart: number
  /** `YYYY-MM-DD`, or null when no day is selected. */
  selectedDate: string | null
  /** The day that owns the grid's single tab stop. */
  focusedDay: number
  onFocusDay: (day: number) => void
  onSelectDay: (day: number) => void
  /** `date` is the day whose cell the event was opened from, `YYYY-MM-DD`. */
  onOpenEvent: (event: CalendarEvent, date: string) => void
}

function chunkWeeks(cells: MonthCell[]): MonthCell[][] {
  const weeks: MonthCell[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/**
 * One role="grid" wrapping a header row of columnheaders and a row per week, which is the
 * structure assistive tech expects — the design renders the weekday strip as a separate
 * bar outside the grid, where it would not be announced as the columns' headers.
 *
 * Roving tabindex: exactly one cell is tabbable and the arrow keys move between them, so a
 * keyboard user crosses the month without tabbing through every chip on the way.
 *
 * A range is drawn as one bar per week, cut only at the week's edges: a month is read with a
 * week of slack either side, so the days a row borrows from the adjacent months carry their
 * objects too, dimmed but drawn. Each bar is a child of the cell
 * its week's segment starts in, which keeps the grid's rows and cells intact, and is
 * positioned against the week row, whose seven equal columns it needs to span. That is why
 * the week numbers sit beside the row, in a gutter of their own, and not in a column of it.
 */
export function MonthGrid({
  cells,
  events,
  typesByKey,
  today,
  showWeekNumbers,
  weekStart,
  selectedDate,
  focusedDay,
  onFocusDay,
  onSelectDay,
  onOpenEvent
}: MonthGridProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const gridRef = useRef<HTMLDivElement>(null)
  const shouldRefocus = useRef(false)

  const weeks = useMemo(() => {
    const chunks = chunkWeeks(cells)
    return chunks.map((week) => ({ week, layout: layOutWeek(events, week) }))
  }, [cells, events])

  useEffect(() => {
    if (!shouldRefocus.current) return
    shouldRefocus.current = false
    gridRef.current?.querySelector<HTMLElement>(`[data-day="${focusedDay}"]`)?.focus()
  }, [focusedDay])

  const lastDay = cells.filter((cell) => !cell.outside).length

  const moveFocus = (delta: number): void => {
    shouldRefocus.current = true
    onFocusDay(Math.min(Math.max(focusedDay + delta, 1), lastDay))
  }

  const handleKeyDown = (event: React.KeyboardEvent, day: number): void => {
    const actions: Record<string, () => void> = {
      ArrowRight: () => moveFocus(1),
      ArrowLeft: () => moveFocus(-1),
      ArrowDown: () => moveFocus(7),
      ArrowUp: () => moveFocus(-7),
      Home: () => moveFocus(1 - focusedDay),
      End: () => moveFocus(lastDay - focusedDay),
      Enter: () => onSelectDay(day),
      ' ': () => onSelectDay(day)
    }
    const action = actions[event.key]
    if (!action) return
    event.preventDefault()
    action()
  }

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label={t('calendar.grid.month')}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div role="row" className="flex border-b border-grid-line-strong bg-surface-card">
        {showWeekNumbers ? <span aria-hidden className="week-number-gutter shrink-0" /> : null}
        <div className="grid flex-1 grid-week">
          {weekdaysFrom(weekStart, i18n.language).map((weekday, index) => (
            <span
              key={weekday}
              role="columnheader"
              className={[
                'px-8 py-6 type-overline text-micro',
                isWeekendColumn(weekStart, index) ? 'text-ink-tertiary' : 'text-ink-secondary'
              ].join(' ')}
            >
              {weekday}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-auto border-l border-grid-line">
        {weeks.map(({ week, layout }, weekIndex) => (
          <div key={weekIndex} className="flex flex-1">
            {showWeekNumbers ? (
              <span
                aria-hidden
                className="week-number-gutter shrink-0 px-4 py-6 text-center type-numeral text-micro text-ink-tertiary"
              >
                {isoWeekNumber(week[(10 - weekStart) % 7].date)}
              </span>
            ) : null}
            <div role="row" className="relative grid flex-1 grid-week">
              {week.map((cell, dayIndex) => (
                <MonthDayCell
                  key={cell.date}
                  cell={cell}
                  segments={layout.segments.filter((segment) => segment.column === dayIndex)}
                  lanes={layout.lanes}
                  hidden={layout.hidden[dayIndex]}
                  typesByKey={typesByKey}
                  isToday={!cell.outside && cell.date === today}
                  isSelected={cell.date === selectedDate}
                  isWeekend={isWeekendColumn(weekStart, dayIndex)}
                  tabbable={!cell.outside && cell.day === focusedDay}
                  onFocus={() => onFocusDay(cell.day)}
                  onSelect={() => onSelectDay(cell.day)}
                  onKeyDown={(event) => handleKeyDown(event, cell.day)}
                  onOpenEvent={(event) => onOpenEvent(event, cell.date)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
