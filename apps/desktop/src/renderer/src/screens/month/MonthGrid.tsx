import { useEffect, useRef } from 'react'
import type { CalendarEvent, MonthCell, ObjectType } from '@renderer/types'
import { eventsOnDay, FIRST_WEEKEND_INDEX, WEEKDAYS } from '@renderer/lib/calendar'
import { MonthDayCell } from './MonthDayCell'

export interface MonthGridProps {
  cells: MonthCell[]
  events: CalendarEvent[]
  typesByKey: Map<string, ObjectType>
  /** `YYYY-MM-DD`. */
  today: string
  selectedDay: number | null
  /** The day that owns the grid's single tab stop. */
  focusedDay: number
  onFocusDay: (day: number) => void
  onSelectDay: (day: number) => void
  /** `day` is the day whose cell the event was opened from. */
  onOpenEvent: (event: CalendarEvent, day: number) => void
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
 * Outside days get no events: only the month's own window was read, so a range reaching into
 * them is drawn up to the month's edge.
 */
export function MonthGrid({
  cells,
  events,
  typesByKey,
  today,
  selectedDay,
  focusedDay,
  onFocusDay,
  onSelectDay,
  onOpenEvent
}: MonthGridProps): React.JSX.Element {
  const gridRef = useRef<HTMLDivElement>(null)
  const shouldRefocus = useRef(false)

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
    <div ref={gridRef} role="grid" aria-label="Month" className="flex min-h-0 flex-1 flex-col">
      <div role="row" className="grid grid-week border-b border-grid-line-strong bg-surface-card">
        {WEEKDAYS.map((weekday, index) => (
          <span
            key={weekday}
            role="columnheader"
            className={[
              'px-8 py-6 type-overline text-micro',
              index >= FIRST_WEEKEND_INDEX ? 'text-ink-tertiary' : 'text-ink-secondary'
            ].join(' ')}
          >
            {weekday}
          </span>
        ))}
      </div>

      <div className="flex flex-1 flex-col overflow-auto border-l border-grid-line">
        {chunkWeeks(cells).map((week, weekIndex) => (
          <div key={weekIndex} role="row" className="grid flex-1 grid-week">
            {week.map((cell, dayIndex) => (
              <MonthDayCell
                key={cell.date}
                cell={cell}
                events={cell.outside ? [] : eventsOnDay(events, cell.date)}
                typesByKey={typesByKey}
                isToday={!cell.outside && cell.date === today}
                isSelected={!cell.outside && cell.day === selectedDay}
                isWeekend={dayIndex >= FIRST_WEEKEND_INDEX}
                tabbable={!cell.outside && cell.day === focusedDay}
                onFocus={() => onFocusDay(cell.day)}
                onSelect={() => onSelectDay(cell.day)}
                onKeyDown={(event) => handleKeyDown(event, cell.day)}
                onOpenEvent={(event) => onOpenEvent(event, cell.day)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
