import { dayLabel, eventHue, isWeekendColumn, weekdayNames } from '@renderer/lib/calendar'
import { timedLanding } from '@renderer/lib/calendar-drag'
import {
  layOutDayColumn,
  MINUTES_PER_DAY,
  minuteAt,
  SNAP_MINUTES,
  splitDayEvents,
  type TimedSegment,
  timeOfMinute,
} from '@renderer/lib/time-grid'
import type { CalendarEvent, CalendarSlot, DayColumn, ObjectType } from '@renderer/types'
import { type CSSProperties, type DragEvent, type MouseEvent, useEffect, useEffectEvent, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AllDayBand } from './AllDayBand'
import { TimedEvent } from './TimedEvent'
import { TimeGutter } from './TimeGutter'
import type { CalendarDrag } from './useCalendarDrag'
import { useDoubleClickSlot } from './useDoubleClickSlot'

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

/** Where the grid opens when today is out of view: early enough to show a working morning. */
const DEFAULT_SCROLL_HOUR = 7

function slotAt(click: MouseEvent, date: string): CalendarSlot {
  const { top, height } = click.currentTarget.getBoundingClientRect()
  const snapped = Math.floor(minuteAt(click.clientY - top, height) / SNAP_MINUTES) * SNAP_MINUTES
  return { date, minute: Math.min(Math.max(snapped, 0), MINUTES_PER_DAY - SNAP_MINUTES) }
}

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
  /** The screen's drags, for the band too. Null where objects cannot be moved. */
  drag: CalendarDrag | null
  /** Asks for a new object at the slot: a minute of the hour grid, or a day of the band. */
  onCreate: (slot: CalendarSlot) => void
}

/**
 * The week and day views, which differ only in how many columns they draw. Objects are placed
 * by the minute over a canvas 24 hours tall; the ones that cover whole days sit in the band
 * above it instead, where a range reads as one bar rather than a box in every column.
 *
 * A timed object is dragged by its body to another time or day, or by its bottom edge to end
 * at another time, a quarter hour at a time; a preview shows where it lands until it is let
 * go. Each day's column takes the drop, at the minute under the pointer; Escape, or a drop
 * outside the hour grid, leaves it where it was.
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
  onOpenEvent,
  drag,
  onCreate,
}: TimeGridProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const scroller = useRef<HTMLDivElement>(null)
  const doubleClick = useDoubleClickSlot(onCreate)

  const split = useMemo(() => days.map((day) => splitDayEvents(events, day.date)), [days, events])
  const weekdays = weekdayNames(i18n.language, 'short')

  /* Opened at the hour worth seeing rather than at midnight: where the day is now, or a
   * working morning when today is not among these days. Only on mount and when the days
   * change — never on a reload, which would yank the view back under the user, nor as the
   * clock moves, which is why the clock is read in an effect event. */
  const scrollToNow = useEffectEvent((shown: DayColumn[]) => {
    const hour = shown.some((day) => day.date === today) ? Math.max(0, nowMinute / 60 - 1) : DEFAULT_SCROLL_HOUR
    const row = scroller.current?.querySelector('[data-hour]')
    if (row) scroller.current?.scrollTo({ top: hour * row.getBoundingClientRect().height })
  })
  useEffect(() => scrollToNow(days), [days])

  const dragged = drag?.dragged ?? null
  const landing = timedLanding(dragged, drag?.over ?? null)

  const startDrag = (segment: TimedSegment, date: string) => (event: DragEvent, mode: 'move' | 'resize') => {
    if (!drag) return
    const drawn = { startMinute: segment.startMinute, endMinute: segment.endMinute }
    if (mode === 'resize') {
      drag.start({ kind: 'resize', event: segment.event, date, drawn }, event)
      return
    }
    // The box is as tall as the minutes it is drawn over.
    const { top, height } = event.currentTarget.getBoundingClientRect()
    const held = ((event.clientY - top) / height) * (drawn.endMinute - drawn.startMinute)
    drag.start({ kind: 'move', event: segment.event, grab: { at: 'time', date, held, drawn } }, event)
  }

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
              <div className="grid-days grid min-w-0 flex-1" style={{ '--days': days.length } as CSSProperties}>
                {days.map((day, index) => {
                  const isToday = day.date === today
                  return (
                    <button
                      key={day.date}
                      type="button"
                      aria-current={isToday ? 'date' : undefined}
                      onClick={() => onSelectDay(day.date)}
                      className={[
                        'flex flex-col items-center gap-2 py-6 type-caption text-tiny',
                        index === 0 ? '' : 'border-l border-grid-line',
                        isWeekendColumn(weekStart, index) ? 'bg-surface-rail' : '',
                        isToday ? 'text-ink-primary' : 'text-ink-secondary',
                      ].join(' ')}
                    >
                      <span>{weekdays[weekdayIndex(weekStart, index)]}</span>
                      <span
                        className={[
                          'flex h-18 min-w-18 items-center justify-center rounded-4 px-4',
                          'font-mono text-tiny tabular-nums',
                          isToday ? 'bg-today-ink text-stone-000' : '',
                          selectedDate === day.date && !isToday ? 'bg-surface-selected' : '',
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
            drag={drag}
            onCreate={(date) => onCreate({ date, minute: null })}
          />
        </div>

        <div className="flex">
          <TimeGutter />
          {/* A table, not a grid: no arrow keys move between its days, as a grid's would. */}
          <table
            aria-label={t(days.length > 1 ? 'calendar.grid.week' : 'calendar.grid.day')}
            className="block min-w-0 flex-1"
          >
            {/* The visible headers are buttons pinned above, outside the table; these name the
                columns for a screen reader, and the whole date, which the buttons abbreviate. */}
            <thead className="sr-only">
              <tr>
                {days.map((day) => (
                  <th key={day.date} scope="col">
                    {dayLabel(day.date, i18n.language)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="block">
              <tr className="grid-days grid" style={{ '--days': days.length } as CSSProperties}>
                {days.map((day, index) => (
                  <td
                    key={day.date}
                    className={[
                      'day-canvas',
                      index === 0 ? '' : 'border-l border-grid-line',
                      isWeekendColumn(weekStart, index) ? 'bg-surface-rail' : 'bg-surface-card',
                    ].join(' ')}
                    {...drag?.timeTarget(day.date)}
                    {...doubleClick.capture}
                  >
                    {/* The pointer's target for the empty day, under the objects drawn after it. */}
                    <div
                      aria-hidden
                      data-slots={day.date}
                      className="absolute inset-0"
                      onClick={(click) => {
                        doubleClick.press(click, slotAt(click, day.date))
                        onSelectDay(day.date)
                      }}
                      onDoubleClick={(click) => onCreate(slotAt(click, day.date))}
                    />
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        data-hour={hour}
                        className={['hour-row', hour === 0 ? '' : 'border-t border-grid-line'].join(' ')}
                      />
                    ))}

                    {layOutDayColumn(split[index]?.timed ?? []).map((segment) => {
                      const { event } = segment
                      const type = typesByKey.get(event.type)
                      return (
                        <TimedEvent
                          key={event.id}
                          segment={segment}
                          title={event.title || t('common.untitled')}
                          category={eventHue(event, type)}
                          {...(event.done === undefined ? {} : { done: event.done })}
                          {...(drag && !event.feed
                            ? { onDragStart: startDrag(segment, day.date), onDragEnd: drag.end }
                            : {})}
                          // Only a type with a To date has an end to pull; a feed's event has no type.
                          resizable={Boolean(type?.to)}
                          lifted={drag?.draggingId === event.id}
                          onClick={() => onOpenEvent(event, day.date)}
                        />
                      )
                    })}

                    {dragged && landing?.date === day.date ? (
                      <TimedEvent
                        segment={{
                          event: dragged.event,
                          startMinute: landing.startMinute,
                          endMinute: landing.endMinute,
                          column: 0,
                          columns: 1,
                        }}
                        title={dragged.event.title || t('common.untitled')}
                        category={eventHue(dragged.event, typesByKey.get(dragged.event.type))}
                        time={timeOfMinute(landing.startMinute)}
                        preview
                        onClick={() => {}}
                      />
                    ) : null}

                    {day.date === today && nowMinute < MINUTES_PER_DAY ? (
                      <div
                        aria-hidden
                        className="now-line pointer-events-none border-t border-today-ink"
                        style={{ '--minute': nowMinute } as CSSProperties}
                      >
                        <span className="absolute -top-3 -left-3 size-6 rounded-pill bg-today-ink" />
                      </div>
                    ) : null}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
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
