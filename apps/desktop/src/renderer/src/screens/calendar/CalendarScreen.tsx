import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  CalendarEvent,
  CalendarMonth,
  DetailTarget,
  ObjectType,
  Space,
  SyncView
} from '@renderer/types'
import { Button, EmptyState } from '@renderer/components/ui'
import { buildMonthGrid, indexBy, monthLabel, spacesByKeys } from '@renderer/lib/calendar'
import { syncDetailText } from '@renderer/lib/sync-text'
import { DateNavigator } from './DateNavigator'
import { DetailPanel } from './DetailPanel'
import { MonthGrid } from './MonthGrid'
import { CalendarTopBar } from './CalendarTopBar'

export interface CalendarScreenProps {
  month: CalendarMonth
  /** Null until the month has been read. */
  events: CalendarEvent[] | null
  /** How the latest read of the month went. */
  status: SyncView
  /** Placed by the dates the selection saved for them. */
  types: ObjectType[]
  spaces: Space[]
  trackedSpaceKeys: string[]
  /** False when no chosen type sits in a chosen space, so no month can hold anything. */
  tracksAnything: boolean
  /** `YYYY-MM-DD`. */
  today: string
  theme: 'light' | 'dark'
  showWeekNumbers: boolean
  weekStart: number
  onToggleTheme: () => void
  onOpenSettings: () => void
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  onReread: () => void
}

/** Draws one month. Keyed by it, so another month starts with no day selected and no panel. */
export function CalendarScreen({
  month,
  events,
  status,
  types,
  spaces,
  trackedSpaceKeys,
  tracksAnything,
  today,
  theme,
  showWeekNumbers,
  weekStart,
  onToggleTheme,
  onOpenSettings,
  onPrevMonth,
  onNextMonth,
  onToday,
  onReread
}: CalendarScreenProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const typesByKey = useMemo(() => indexBy(types), [types])
  const spacesByKey = useMemo(() => indexBy(spaces), [spaces])
  const cells = useMemo(
    () => buildMonthGrid(month.year, month.month, weekStart),
    [month.year, month.month, weekStart]
  )
  const trackedSpaces = spacesByKeys(spaces, trackedSpaceKeys)
  const label = monthLabel(month.year, month.month, i18n.language)
  const todayCell = cells.find((cell) => !cell.outside && cell.date === today)

  const [detail, setDetail] = useState<DetailTarget | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [focusedDay, setFocusedDay] = useState(todayCell?.day ?? 1)

  const openEvent = (event: CalendarEvent, day?: number): void => {
    if (day !== undefined) setSelectedDay(day)
    setDetail({ kind: 'event', event })
  }

  const selectDay = (day: number): void => {
    const cell = cells.find((candidate) => !candidate.outside && candidate.day === day)
    if (!cell) return
    setSelectedDay(day)
    setDetail({ kind: 'day', date: cell.date })
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
        legendSpaces={trackedSpaces}
        onPrev={onPrevMonth}
        onNext={onNextMonth}
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
                title={t('calendar.couldntRead', { month: label })}
                description={syncDetailText(t, status.detail)}
                action={
                  <Button variant="secondary" size="sm" iconLeft="refresh-cw" onClick={onReread}>
                    {t('common.tryAgain')}
                  </Button>
                }
              />
            </Centered>
          ) : events !== null && events.length === 0 ? (
            <Centered>
              <EmptyState
                icon="calendar-days"
                title={t('calendar.nothingDated', { month: label })}
                description={t('calendar.nothingDatedDescription')}
                action={
                  todayCell ? undefined : (
                    <Button variant="secondary" size="sm" onClick={onToday}>
                      {t('calendar.backToToday')}
                    </Button>
                  )
                }
              />
            </Centered>
          ) : (
            <MonthGrid
              cells={cells}
              events={events ?? []}
              typesByKey={typesByKey}
              today={today}
              showWeekNumbers={showWeekNumbers}
              weekStart={weekStart}
              selectedDay={selectedDay}
              focusedDay={focusedDay}
              onFocusDay={setFocusedDay}
              onSelectDay={selectDay}
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

function Centered({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="flex flex-1 items-center justify-center">{children}</div>
}
