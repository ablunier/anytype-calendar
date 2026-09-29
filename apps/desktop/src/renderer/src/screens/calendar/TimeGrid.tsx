import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { CalendarEvent, CalendarSlot, DayColumn, ObjectType } from '@renderer/types'
import { eventHue, isWeekendColumn, weekdayNames } from '@renderer/lib/calendar'
import {
  draggedPlacement,
  layOutDayColumn,
  MINUTES_PER_DAY,
  SNAP_MINUTES,
  splitDayEvents,
  timeOfMinute,
  type TimedSegment
} from '@renderer/lib/time-grid'
import { AllDayBand } from './AllDayBand'
import { TimedEvent } from './TimedEvent'
import { TimeGutter } from './TimeGutter'

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

/** Where the grid opens when today is out of view: early enough to show a working morning. */
const DEFAULT_SCROLL_HOUR = 7

/** How far the pointer goes before a press on an object is a drag rather than a click. */
const DRAG_THRESHOLD_PX = 4

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
  /**
   * `slot` is where it now starts, or for a resize where it now ends. Left off where objects
   * cannot be moved.
   */
  onMoveEvent?: (event: CalendarEvent, slot: CalendarSlot) => void
  onResizeEvent?: (event: CalendarEvent, slot: CalendarSlot) => void
  /** Asks for a new object at the slot: a minute of the hour grid, or a day of the band. */
  onCreate: (slot: CalendarSlot) => void
}

/** A press on a timed object, which becomes a drag once the pointer has gone far enough. */
interface Press {
  segment: TimedSegment
  mode: 'move' | 'resize'
  dayIndex: number
  originX: number
  originY: number
  /** Measured when it began: pixels per hour down the grid, and per day across it. */
  hourPx: number
  dayPx: number
  dx: number
  dy: number
  dragging: boolean
}

/**
 * The week and day views, which differ only in how many columns they draw. Objects are placed
 * by the minute over a canvas 24 hours tall; the ones that cover whole days sit in the band
 * above it instead, where a range reads as one bar rather than a box in every column.
 *
 * A timed object is dragged by its body to another time or day, or by its bottom edge to end
 * at another time, a quarter hour at a time; a preview shows where it lands until it is let
 * go. Escape drops the drag.
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
  onMoveEvent,
  onResizeEvent,
  onCreate
}: TimeGridProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const scroller = useRef<HTMLDivElement>(null)
  const grid = useRef<HTMLDivElement>(null)
  const [press, setPress] = useState<Press | null>(null)
  // The click that ends a drag is not a click on the object.
  const swallowClick = useRef(false)

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

  const placement = press?.dragging
    ? draggedPlacement({
        mode: press.mode,
        dayIndex: press.dayIndex,
        startMinute: press.segment.startMinute,
        endMinute: press.segment.endMinute,
        minutes: (press.dy / press.hourPx) * 60,
        days: Math.round(press.dx / press.dayPx),
        dayCount: days.length
      })
    : null

  /* Followed on the window, not the object: the pointer leaves it as soon as the drag moves
   * it, and the object is redrawn under the pointer in another column. */
  const pressing = press !== null
  const latest = useRef({ press, placement })
  latest.current = { press, placement }
  useEffect(() => {
    if (!pressing) return
    const move = (pointer: globalThis.PointerEvent): void => {
      setPress((current) => {
        if (!current) return current
        const dx = pointer.clientX - current.originX
        const dy = pointer.clientY - current.originY
        const dragging = current.dragging || Math.hypot(dx, dy) > DRAG_THRESHOLD_PX
        return { ...current, dx, dy, dragging }
      })
    }
    const drop = (): void => {
      const { press: ended, placement: landed } = latest.current
      setPress(null)
      if (!ended?.dragging || !landed) return
      swallowClick.current = true
      // Cleared after the click the release fires, if it fires one on the object at all.
      setTimeout(() => {
        swallowClick.current = false
      })
      const { event, startMinute, endMinute } = ended.segment
      const date = days[landed.dayIndex]?.date
      if (date === undefined) return
      if (ended.mode === 'move') {
        if (landed.startMinute !== startMinute || landed.dayIndex !== ended.dayIndex) {
          onMoveEvent?.(event, { date, minute: landed.startMinute })
        }
      } else if (landed.endMinute !== endMinute) {
        onResizeEvent?.(event, { date, minute: landed.endMinute })
      }
    }
    const cancel = (): void => setPress(null)
    const escape = (key: KeyboardEvent): void => {
      if (key.key === 'Escape') cancel()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', drop)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', drop)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('keydown', escape)
    }
  }, [pressing, days, onMoveEvent, onResizeEvent])

  const beginPress = (segment: TimedSegment, dayIndex: number) => (pointer: PointerEvent, mode: 'move' | 'resize') => {
    const root = grid.current
    const row = root?.querySelector('[data-hour]')
    if (!root || !row) return
    setPress({
      segment,
      mode,
      dayIndex,
      originX: pointer.clientX,
      originY: pointer.clientY,
      hourPx: row.getBoundingClientRect().height,
      dayPx: root.getBoundingClientRect().width / days.length,
      dx: 0,
      dy: 0,
      dragging: false
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col border-l border-grid-line">
      {/* The day columns, the headers naming them and the all-day band all scroll in one
          container, so they are narrowed by the same scrollbar and their columns line up.
          Header and band are pinned to the top of it rather than placed above it: outside,
          they would keep the width the scrollbar takes from the grid. Pinning them together
          also keeps `scrollTop` the hour offset it would be without them, since the pinned
          block covers exactly the space above the day canvas. */}
      <div
        ref={scroller}
        className={['min-h-0 flex-1 overflow-auto', press?.dragging ? 'cursor-grabbing select-none' : ''].join(' ')}
      >
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
            {...(onMoveEvent
              ? { onMoveEvent: (event: CalendarEvent, date: string) => onMoveEvent(event, { date, minute: null }) }
              : {})}
            onCreate={(date) => onCreate({ date, minute: null })}
          />
        </div>

        <div className="flex">
          <TimeGutter />
          <div
            ref={grid}
            role="grid"
            aria-label={t(days.length > 1 ? 'calendar.grid.week' : 'calendar.grid.day')}
            className="grid-days grid min-w-0 flex-1"
            style={{ '--days': days.length } as CSSProperties}
          >
            {days.map((day, index) => (
              <div
                key={day.date}
                role="gridcell"
                onClick={() => {
                  if (!swallowClick.current) onSelectDay(day.date)
                }}
                onDoubleClick={(click) => {
                  const { top, height } = click.currentTarget.getBoundingClientRect()
                  const minute = ((click.clientY - top) / height) * MINUTES_PER_DAY
                  const snapped = Math.floor(minute / SNAP_MINUTES) * SNAP_MINUTES
                  onCreate({ date: day.date, minute: Math.min(Math.max(snapped, 0), MINUTES_PER_DAY - SNAP_MINUTES) })
                }}
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
                  const { event } = segment
                  const type = typesByKey.get(event.type)
                  return (
                    <TimedEvent
                      key={event.id}
                      segment={segment}
                      title={event.title || t('common.untitled')}
                      category={eventHue(event, type)}
                      {...(event.done === undefined ? {} : { done: event.done })}
                      {...(onMoveEvent ? { onDragStart: beginPress(segment, index) } : {})}
                      // Only a type with a To date has an end to pull.
                      resizable={onResizeEvent !== undefined && Boolean(type?.to)}
                      lifted={press?.dragging === true && press.segment.event.id === event.id}
                      onClick={() => {
                        if (!swallowClick.current) onOpenEvent(event, day.date)
                      }}
                    />
                  )
                })}

                {press && placement?.dayIndex === index ? (
                  <TimedEvent
                    segment={{
                      event: press.segment.event,
                      startMinute: placement.startMinute,
                      endMinute: placement.endMinute,
                      column: 0,
                      columns: 1
                    }}
                    title={press.segment.event.title || t('common.untitled')}
                    category={eventHue(press.segment.event, typesByKey.get(press.segment.event.type))}
                    time={timeOfMinute(placement.startMinute)}
                    preview
                    onClick={() => {}}
                  />
                ) : null}

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
