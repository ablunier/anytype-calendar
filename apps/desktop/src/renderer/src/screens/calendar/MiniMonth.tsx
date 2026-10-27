import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CalendarMonth } from '@renderer/types'
import { IconButton } from '@renderer/components/ui'
import {
  buildMonthGrid,
  isoWeekNumber,
  longDate,
  monthLabel,
  weekdaysFrom
} from '@renderer/lib/calendar'
import { shiftSpan } from '@renderer/lib/events'

export interface MiniMonthProps {
  label: string
  /** `YYYY-MM-DD`: the month first shown is this day's. */
  opensOn: string
  /** The days marked as chosen, `YYYY-MM-DD`, both included. */
  marked: { first: string; last: string }
  /** `YYYY-MM-DD`. */
  today: string
  weekStart: number
  showWeekNumbers: boolean
  /** `YYYY-MM-DD`; the days before it cannot be picked. */
  min?: string
  /** `date` is `YYYY-MM-DD`. */
  onSelectDate: (date: string) => void
}

/**
 * One month to pick a day from: the sidebar's, to get around by, and a date field's. Its
 * arrows step through months on their own; it opens on the month of `opensOn` and does not
 * follow it later, so whoever wants it to start over keys it. It marks no day that holds
 * objects, which would mean reading months that are not on screen.
 */
export function MiniMonth({
  label,
  opensOn,
  marked: { first, last },
  today,
  weekStart,
  showWeekNumbers,
  min,
  onSelectDate
}: MiniMonthProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const [shown, setShown] = useState<CalendarMonth>(() => monthOfDate(opensOn))

  const weeks = chunkWeeks(buildMonthGrid(shown.year, shown.month, weekStart))
  const step = (delta: number): void => {
    const next = shiftSpan({ kind: 'month', ...shown }, delta)
    if (next.kind === 'month') setShown({ year: next.year, month: next.month })
  }

  return (
    <section aria-label={label} className="flex shrink-0 flex-col gap-8">
      <div className="flex items-center justify-between">
        <h2 className="type-ui text-small text-ink-primary">
          {monthLabel(shown.year, shown.month, i18n.language)}
        </h2>
        <div className="flex items-center gap-2">
          <IconButton size="sm" icon="chevron-left" label={t('calendar.nav.prev.month')} onClick={() => step(-1)} />
          <IconButton size="sm" icon="chevron-right" label={t('calendar.nav.next.month')} onClick={() => step(1)} />
        </div>
      </div>

      <div role="grid" aria-label={monthLabel(shown.year, shown.month, i18n.language)} className="flex flex-col">
        <div role="row" className="flex">
          {showWeekNumbers ? <span aria-hidden className="w-24 shrink-0" /> : null}
          <div className="grid flex-1 grid-cols-7">
            {weekdaysFrom(weekStart, i18n.language).map((weekday, column) => (
              <span
                key={column}
                role="columnheader"
                aria-label={weekday}
                className="py-4 text-center type-overline text-micro text-ink-tertiary"
              >
                {weekday.slice(0, 2)}
              </span>
            ))}
          </div>
        </div>

        {weeks.map((week) => (
          <div key={week[0]?.date} role="row" className="flex">
            {showWeekNumbers ? (
              <span
                aria-hidden
                className="flex h-24 w-24 shrink-0 items-center justify-center type-numeral text-micro text-ink-tertiary"
              >
                {isoWeekNumber(week[(10 - weekStart) % 7]?.date ?? '')}
              </span>
            ) : null}
            <div className="grid flex-1 grid-cols-7">
              {week.map(({ date, day, outside }) => {
                const isToday = date === today
                const inSpan = first <= date && date <= last
                const disabled = min !== undefined && date < min
                return (
                  <button
                    key={date}
                    type="button"
                    role="gridcell"
                    aria-label={longDate(date, i18n.language)}
                    aria-current={isToday ? 'date' : undefined}
                    aria-selected={inSpan}
                    disabled={disabled}
                    onClick={() => onSelectDate(date)}
                    className={[
                      'h-24 border-0 type-numeral text-micro transition duration-fast ease-standard',
                      disabled
                        ? 'cursor-not-allowed bg-transparent text-ink-muted opacity-50'
                        : isToday
                        ? 'bg-surface-accent text-ink-inverse'
                        : inSpan
                          ? 'bg-surface-sunken text-ink-primary hover:bg-surface-active'
                          : [
                              'bg-transparent hover:bg-surface-hover',
                              outside ? 'text-ink-muted' : 'text-ink-body'
                            ].join(' ')
                    ].join(' ')}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function monthOfDate(date: string): CalendarMonth {
  const [year, month = 1] = date.split('-').map(Number)
  return { year, month: month - 1 }
}

function chunkWeeks<T>(cells: T[]): T[][] {
  const weeks: T[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
