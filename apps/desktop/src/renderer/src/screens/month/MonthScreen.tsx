import { useMemo, useState } from 'react'
import type { CalendarData, CalendarEvent, DetailTarget } from '@renderer/types'
import { Button, EmptyState } from '@renderer/components/ui'
import { buildMonthGrid, indexBy, MONTH_NAMES, spacesByKeys } from '@renderer/lib/calendar'
import { DateNavigator } from './DateNavigator'
import { DetailPanel } from './DetailPanel'
import { MonthGrid } from './MonthGrid'
import { MonthTopBar } from './MonthTopBar'

export interface MonthScreenProps {
  data: CalendarData
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onOpenSettings: () => void
}

export function MonthScreen({
  data,
  theme,
  onToggleTheme,
  onOpenSettings
}: MonthScreenProps): React.JSX.Element {
  const [offset, setOffset] = useState(0)
  const [detail, setDetail] = useState<DetailTarget | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [focusedDay, setFocusedDay] = useState(data.today)

  const typesByKey = useMemo(() => indexBy(data.types), [data.types])
  const spacesByKey = useMemo(() => indexBy(data.spaces), [data.spaces])
  const cells = useMemo(() => buildMonthGrid(data.year, data.month), [data.year, data.month])
  const trackedSpaces = spacesByKeys(data.spaces, data.trackedSpaceKeys)

  const visibleEvents = useMemo(
    () =>
      data.events.filter((event) => {
        const type = typesByKey.get(event.type)
        return (
          type !== undefined &&
          data.trackedTypeKeys.includes(event.type) &&
          data.trackedSpaceKeys.includes(type.space)
        )
      }),
    [data.events, data.trackedTypeKeys, data.trackedSpaceKeys, typesByKey]
  )

  const label = `${MONTH_NAMES[(data.month + offset + 12) % 12]} ${data.year}`
  const isFixtureMonth = offset === 0

  const openEvent = (event: CalendarEvent): void => {
    setSelectedDay(event.day)
    setDetail({ kind: 'object', event })
  }

  const selectDay = (day: number): void => {
    setSelectedDay(day)
    setDetail({ kind: 'day', day })
  }

  return (
    <div className="flex h-full flex-col bg-surface-page">
      <MonthTopBar
        trackedSpaces={trackedSpaces}
        totalSpaces={data.spaces.length}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onOpenSettings={onOpenSettings}
      />

      <DateNavigator
        title={label}
        subtitle={`${isFixtureMonth ? visibleEvents.length : 0} objects`}
        legendSpaces={trackedSpaces}
        onPrev={() => setOffset((value) => value - 1)}
        onNext={() => setOffset((value) => value + 1)}
        onToday={() => setOffset(0)}
      />

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          {isFixtureMonth ? (
            <MonthGrid
              cells={cells}
              events={visibleEvents}
              typesByKey={typesByKey}
              year={data.year}
              month={data.month}
              today={data.today}
              selectedDay={selectedDay}
              focusedDay={focusedDay}
              onFocusDay={setFocusedDay}
              onSelectDay={selectDay}
              onOpenEvent={openEvent}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon="calendar-days"
                title={`Nothing dated in ${label}`}
                description="Objects appear here once they have a date relation on a tracked type."
                action={
                  <Button variant="secondary" size="sm" onClick={() => setOffset(0)}>
                    Back to {data.monthLabel.split(' ')[0]}
                  </Button>
                }
              />
            </div>
          )}
        </main>

        {detail ? (
          <DetailPanel
            detail={detail}
            events={visibleEvents}
            typesByKey={typesByKey}
            spacesByKey={spacesByKey}
            year={data.year}
            month={data.month}
            onClose={() => setDetail(null)}
            onOpenEvent={openEvent}
          />
        ) : null}
      </div>
    </div>
  )
}
