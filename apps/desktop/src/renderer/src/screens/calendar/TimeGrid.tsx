import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { CalendarEvent, DayColumn, ObjectType } from '@renderer/types'
import { eventHue, isWeekendColumn, weekdayNames } from '@renderer/lib/calendar'
import { layOutDayColumn, MINUTES_PER_DAY, splitDayEvents } from '@renderer/lib/time-grid'
import { AllDayBand } from './AllDayBand'
import { TimedEvent } from './TimedEvent'
import { TimeGutter } from './TimeGutter'

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

/** Where the grid opens when today is out of view: early enough to show a working morning. */
const DEFAULT_SCROLL_HOUR = 7

export interface TimeGridProps {
  /** Seven days for a week, one for a day. */
  days: DayColumn[]
  events: CalendarEvent[]
  typesByKey: Map<string, ObjectType>
  /** `YYYY-MM-DD`. */
  today: string
  /** Minutes from midnight, for the line marking the current time. */
  nowMinute: number
  weekStart: number
  selectedDate: string | null
  onSelectDay: (date: string) => void
  onOpenEvent: (event: CalendarEvent, date: string) => void
}

/**
 * The week and day views, which differ only in how many columns they draw. Objects are placed
 * by the minute over a canvas 24 hours tall; the ones that cover whole days sit in the band
 * above it instead, where a range reads as one bar rather than a box in every column.
 */
export function TimeGrid({
  days,
  events,
  typesByKey,
  today,
  nowMinute,
  weekStart,
  selectedDate,
  onSelectDay,
  onOpenEvent
}: TimeGridProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const scroller = useRef<HTMLDivElement>(null)

  const split = useMemo(() => days.map((day) => splitDayEvents(events, day.date)), [days, events])
  const weekdays = weekdayNames(i18n.language, 'short')
  const todayColumn = days.findIndex((day) => day.date === today)

  /* Opened at the hour worth seeing rather than at midnight: where the day is now, or a
   * working morning when today is not among these days. Only on mount and when the days
   * change — never on a reload, which would yank the view back under the user. */
  useEffect(() => {
    const hour = todayColumn === -1 ? DEFAULT_SCROLL_HOUR : Math.max(0, nowMinute / 60 - 1)
    const row = scroller.current?.querySelector('[data-hour]')
    if (row) scroller.current?.scrollTo({ top: hour * row.getBoundingClientRect().height })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the current minute must not re-scroll
  }, [days])

  return (
    <div className="flex min-h-0 flex-1 flex-col border-l border-grid-line">
      {/* The day columns, the headers naming them and the all-day band all scroll in one
          container, so they are narrowed by the same scrollbar and their columns line up.
          Header and band are pinned to the top of it rather than placed above it: outside,
          they would keep the width the scrollbar takes from the grid. Pinning them together
          also keeps `scrollTop` the hour offset it would be without them, since the pinned
          block covers exactly the space above the day canvas. */}
      <div ref={scroller} className="min-h-0 flex-1 overflow-auto">
        <div className="sticky top-0 z-10 bg-surface-card">
          {/* A day view needs no column header: the navigator's own heading already names it. */}
          {days.length > 1 ? (
            <div className="flex border-b border-grid-line">
              <span className="w-hour-gutter shrink-0" />
              <div
                role="row"
                className="grid-days grid min-w-0 flex-1"
                style={{ '--days': days.length } as CSSProperties}
              >
                {days.map((day, index) => {
                  const isToday = day.date === today
                  return (
                    <button
                      key={day.date}
                      type="button"
                      role="columnheader"
                      aria-current={isToday ? 'date' : undefined}
                      onClick={() => onSelectDay(day.date)}
                      className={[
                        'flex flex-col items-center gap-2 py-6 type-caption text-tiny',
                        index === 0 ? '' : 'border-l border-grid-line',
                        isWeekendColumn(weekStart, index) ? 'bg-surface-rail' : '',
                        isToday ? 'text-ink-primary' : 'text-ink-secondary'
                      ].join(' ')}
                    >
                      <span>{weekdays[weekdayIndex(weekStart, index)]}</span>
                      <span
                        className={[
                          'flex h-18 min-w-18 items-center justify-center rounded-4 px-4',
                          'font-mono text-tiny tabular-nums',
                          isToday ? 'bg-today-ink text-stone-000' : '',
                          selectedDate === day.date && !isToday ? 'bg-surface-selected' : ''
                        ].join(' ')}
                      >
                        {dayNumber(day.date)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <AllDayBand
            days={days}
            eventsByDay={split.map(({ band }) => band)}
            typesByKey={typesByKey}
            onOpenEvent={onOpenEvent}
          />
        </div>

        <div className="flex">
          <TimeGutter />
          <div
            role="grid"
            aria-label={t(days.length > 1 ? 'calendar.grid.week' : 'calendar.grid.day')}
            className="grid-days grid min-w-0 flex-1"
            style={{ '--days': days.length } as CSSProperties}
          >
            {days.map((day, index) => (
              <div
                key={day.date}
                role="gridcell"
                onClick={() => onSelectDay(day.date)}
                className={[
                  'day-canvas',
                  index === 0 ? '' : 'border-l border-grid-line',
                  isWeekendColumn(weekStart, index) ? 'bg-surface-rail' : 'bg-surface-card'
                ].join(' ')}
              >
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    data-hour={hour}
                    className={['hour-row', hour === 0 ? '' : 'border-t border-grid-line'].join(' ')}
                  />
                ))}

                {layOutDayColumn(split[index]?.timed ?? []).map((segment) => {
                  const type = typesByKey.get(segment.event.type)
                  return (
                    <TimedEvent
                      key={segment.event.id}
                      segment={segment}
                      title={segment.event.title || t('common.untitled')}
                      category={eventHue(segment.event, type)}
                      {...(segment.event.done === undefined ? {} : { done: segment.event.done })}
                      onClick={() => onOpenEvent(segment.event, day.date)}
                    />
                  )
                })}

                {day.date === today && nowMinute < MINUTES_PER_DAY ? (
                  <div
                    aria-hidden
                    className="now-line border-t border-today-ink"
                    style={{ '--minute': nowMinute } as CSSProperties}
                  >
                    <span className="absolute -top-3 -left-3 size-6 rounded-pill bg-today-ink" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** The weekday (Monday 0) shown in `column` of a week that starts on `weekStart`. */
function weekdayIndex(weekStart: number, column: number): number {
  return (weekStart + column) % 7
}

function dayNumber(date: string): number {
  return Number(date.slice(8))
}
