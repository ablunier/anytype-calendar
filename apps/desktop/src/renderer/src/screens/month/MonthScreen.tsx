import { useMemo, useState } from 'react'
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
import { DateNavigator } from './DateNavigator'
import { DetailPanel } from './DetailPanel'
import { MonthGrid } from './MonthGrid'
import { MonthTopBar } from './MonthTopBar'

export interface MonthScreenProps {
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
  onToggleTheme: () => void
  onOpenSettings: () => void
  onPrevMonth: () => void
  onNextMonth: () => void
  onToday: () => void
  onReread: () => void
}

/** Draws one month. Keyed by it, so another month starts with no day selected and no panel. */
export function MonthScreen({
  month,
  events,
  status,
  types,
  spaces,
  trackedSpaceKeys,
  tracksAnything,
  today,
  theme,
  onToggleTheme,
  onOpenSettings,
  onPrevMonth,
  onNextMonth,
  onToday,
  onReread
}: MonthScreenProps): React.JSX.Element {
  const typesByKey = useMemo(() => indexBy(types), [types])
  const spacesByKey = useMemo(() => indexBy(spaces), [spaces])
  const cells = useMemo(() => buildMonthGrid(month.year, month.month), [month.year, month.month])
  const trackedSpaces = spacesByKeys(spaces, trackedSpaceKeys)
  const label = monthLabel(month.year, month.month)
  const todayCell = cells.find((cell) => !cell.outside && cell.date === today)

  const [detail, setDetail] = useState<DetailTarget | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [focusedDay, setFocusedDay] = useState(todayCell?.day ?? 1)

  const openEvent = (event: CalendarEvent, day?: number): void => {
    if (day !== undefined) setSelectedDay(day)
    setDetail({ kind: 'object', event })
  }

  const selectDay = (day: number): void => {
    const cell = cells.find((candidate) => !candidate.outside && candidate.day === day)
    if (!cell) return
    setSelectedDay(day)
    setDetail({ kind: 'day', date: cell.date })
  }

  return (
    <div className="flex h-full flex-col bg-surface-page">
      <MonthTopBar
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
                title="Choose what goes on the calendar"
                description="Pick the spaces and types whose dates you want to see here."
                action={
                  <Button variant="secondary" size="sm" onClick={onOpenSettings}>
                    Open Settings
                  </Button>
                }
              />
            </Centered>
          ) : events === null && status.state === 'error' ? (
            <Centered>
              <EmptyState
                icon="circle-alert"
                title={`Couldn't read ${label}`}
                description={status.detail}
                action={
                  <Button variant="secondary" size="sm" iconLeft="refresh-cw" onClick={onReread}>
                    Try again
                  </Button>
                }
              />
            </Centered>
          ) : events !== null && events.length === 0 ? (
            <Centered>
              <EmptyState
                icon="calendar-days"
                title={`Nothing dated in ${label}`}
                description="Objects of the types you track appear here once one of their dates falls in this month."
                action={
                  todayCell ? undefined : (
                    <Button variant="secondary" size="sm" onClick={onToday}>
                      Back to today
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
