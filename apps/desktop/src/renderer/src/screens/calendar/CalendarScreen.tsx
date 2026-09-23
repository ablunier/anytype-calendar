import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EventsSpan } from '@anytype-calendar/events/domain'
import type {
  CalendarEvent,
  CalendarView,
  DetailTarget,
  ObjectType,
  Space,
  SyncView
} from '@renderer/types'
import { Button, EmptyState } from '@renderer/components/ui'
import {
  buildMonthGrid,
  buildWeek,
  dayLabel,
  indexBy,
  monthLabel,
  spacesByKeys,
  weekLabel
} from '@renderer/lib/calendar'
import { anchorOf } from '@renderer/lib/events'
import { syncDetailText } from '@renderer/lib/sync-text'
import { CalendarTopBar } from './CalendarTopBar'
import { DateNavigator } from './DateNavigator'
import { DetailPanel } from './DetailPanel'
import { MonthGrid } from './MonthGrid'
import { TimeGrid } from './TimeGrid'

export interface CalendarScreenProps {
  /** What is on screen, which main holds: a month, a week or a day. */
  span: EventsSpan
  /** Null until the span has been read. */
  events: CalendarEvent[] | null
  /** How the latest read of the span went. */
  status: SyncView
  /** Placed by the dates the selection saved for them. */
  types: ObjectType[]
  spaces: Space[]
  trackedSpaceKeys: string[]
  /** False when no chosen type sits in a chosen space, so no span can hold anything. */
  tracksAnything: boolean
  /** `YYYY-MM-DD`. */
  today: string
  /** Minutes from midnight, for the line marking the current time. */
  nowMinute: number
  theme: 'light' | 'dark'
  showWeekNumbers: boolean
  weekStart: number
  onToggleTheme: () => void
  onOpenSettings: () => void
  onView: (view: CalendarView) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onReread: () => void
}

/** Draws one span. Keyed by it, so another span starts with no day selected and no panel. */
export function CalendarScreen({
  span,
  events,
  status,
  types,
  spaces,
  trackedSpaceKeys,
  tracksAnything,
  today,
  nowMinute,
  theme,
  showWeekNumbers,
  weekStart,
  onToggleTheme,
  onOpenSettings,
  onView,
  onPrev,
  onNext,
  onToday,
  onReread
}: CalendarScreenProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const typesByKey = useMemo(() => indexBy(types), [types])
  const spacesByKey = useMemo(() => indexBy(spaces), [spaces])
  const anchor = anchorOf(span)

  const cells = useMemo(
    () => (span.kind === 'month' ? buildMonthGrid(span.year, span.month, weekStart) : []),
    [span, weekStart]
  )
  const days = useMemo(
    () =>
      span.kind === 'week'
        ? buildWeek(anchor, weekStart)
        : span.kind === 'day'
          ? [{ date: anchor, outside: false }]
          : [],
    [span.kind, anchor, weekStart]
  )

  const trackedSpaces = spacesByKeys(spaces, trackedSpaceKeys)
  const label = labelFor(span, days, i18n.language)
  const showsToday =
    span.kind === 'month'
      ? cells.some((cell) => !cell.outside && cell.date === today)
      : days.some((day) => day.date === today)

  const [detail, setDetail] = useState<DetailTarget | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [focusedDay, setFocusedDay] = useState(
    () => cells.find((cell) => !cell.outside && cell.date === today)?.day ?? 1
  )

  const openEvent = (event: CalendarEvent, date?: string): void => {
    if (date !== undefined) setSelectedDate(date)
    setDetail({ kind: 'event', event })
  }

  const selectDate = (date: string): void => {
    setSelectedDate(date)
    setDetail({ kind: 'day', date })
  }

  const selectDay = (day: number): void => {
    const cell = cells.find((candidate) => !candidate.outside && candidate.day === day)
    if (cell) selectDate(cell.date)
  }

  return (
    <div className="flex h-full flex-col bg-surface-page">
      <CalendarTopBar
        sync={status}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onOpenSettings={onOpenSettings}
        onReread={onReread}
      />

      <DateNavigator
        title={label}
        view={span.kind}
        legendSpaces={trackedSpaces}
        onView={onView}
        onPrev={onPrev}
        onNext={onNext}
        onToday={onToday}
      />

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          {!tracksAnything ? (
            <Centered>
              <EmptyState
                icon="sliders-horizontal"
                title={t('calendar.chooseWhatGoesOn')}
                description={t('calendar.chooseWhatGoesOnDescription')}
                action={
                  <Button variant="secondary" size="sm" onClick={onOpenSettings}>
                    {t('calendar.openSettings')}
                  </Button>
                }
              />
            </Centered>
          ) : events === null && status.state === 'error' ? (
            <Centered>
              <EmptyState
                icon="circle-alert"
                title={t('calendar.couldntRead', { span: label })}
                description={syncDetailText(t, status.detail)}
                action={
                  <Button variant="secondary" size="sm" iconLeft="refresh-cw" onClick={onReread}>
                    {t('common.tryAgain')}
                  </Button>
                }
              />
            </Centered>
          ) : /* A time grid is drawn even when empty: its hours are the point, and the
                 all-day band would otherwise be the only thing on screen. */
          events !== null && events.length === 0 && span.kind === 'month' ? (
            <Centered>
              <EmptyState
                icon="calendar-days"
                title={t('calendar.nothingDated', { span: label })}
                description={t('calendar.nothingDatedDescription')}
                action={
                  showsToday ? undefined : (
                    <Button variant="secondary" size="sm" onClick={onToday}>
                      {t('calendar.backToToday')}
                    </Button>
                  )
                }
              />
            </Centered>
          ) : span.kind === 'month' ? (
            <MonthGrid
              cells={cells}
              events={events ?? []}
              typesByKey={typesByKey}
              today={today}
              showWeekNumbers={showWeekNumbers}
              weekStart={weekStart}
              selectedDate={selectedDate}
              focusedDay={focusedDay}
              onFocusDay={setFocusedDay}
              onSelectDay={selectDay}
              onOpenEvent={openEvent}
            />
          ) : (
            <TimeGrid
              days={days}
              events={events ?? []}
              typesByKey={typesByKey}
              today={today}
              nowMinute={nowMinute}
              weekStart={weekStart}
              selectedDate={selectedDate}
              onSelectDay={selectDate}
              onOpenEvent={openEvent}
            />
          )}
        </main>

        {detail ? (
          <DetailPanel
            detail={detail}
            events={events ?? []}
            typesByKey={typesByKey}
            spacesByKey={spacesByKey}
            onClose={() => setDetail(null)}
            onOpenEvent={openEvent}
          />
        ) : null}
      </div>
    </div>
  )
}

function labelFor(span: EventsSpan, days: { date: string }[], locale: string): string {
  if (span.kind === 'month') return monthLabel(span.year, span.month, locale)
  if (span.kind === 'day') return dayLabel(days[0]?.date ?? '', locale)
  return weekLabel(days[0]?.date ?? '', days[days.length - 1]?.date ?? '', locale)
}

function Centered({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="flex flex-1 items-center justify-center">{children}</div>
}
