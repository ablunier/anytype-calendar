import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { CalendarEvent, DayColumn, ObjectType } from '@renderer/types'
import { layOutWeek } from '@renderer/lib/month-layout'
import { EventChip } from './EventChip'

/** A band has room to grow, unlike a month cell, so nothing is hidden behind a `+N more`. */
const BAND_LANES = 8

export interface AllDayBandProps {
  days: DayColumn[]
  /** Per day, in the same order: what `splitDayEvents` sent to the band. */
  eventsByDay: CalendarEvent[][]
  typesByKey: Map<string, ObjectType>
  onOpenEvent: (event: CalendarEvent, date: string) => void
}

/**
 * The strip above the hour grid: objects with no time of day, and ranges that cross midnight,
 * drawn as one bar across the days they cover. It reuses the month grid's own lane packing —
 * the same problem, one row of it.
 */
export function AllDayBand({
  days,
  eventsByDay,
  typesByKey,
  onOpenEvent
}: AllDayBandProps): React.JSX.Element {
  const { t } = useTranslation()
  // One bar per object, so an object covering several of these days is laid out once.
  const events = [...new Map(eventsByDay.flat().map((event) => [event.id, event])).values()]
  const layout = layOutWeek(events, days, BAND_LANES)

  return (
    <div className="flex shrink-0 border-b border-grid-line-strong bg-surface-card">
      <span className="flex w-hour-gutter shrink-0 items-start justify-end pt-6 pr-6 type-caption text-micro text-ink-muted">
        {t('calendar.allDay')}
      </span>
      <div
        className="grid-days relative grid min-w-0 flex-1 py-2"
        style={{ '--days': days.length } as CSSProperties}
      >
        {days.map((day, index) => (
          <div
            key={day.date}
            className={['min-h-20', index === 0 ? '' : 'border-l border-grid-line'].join(' ')}
          >
            {/* Reserves the row's height: the bars themselves are out of the flow. */}
            <div className="lane-stack" style={{ '--lanes': layout.lanes } as CSSProperties} />
          </div>
        ))}
        {layout.segments.map((segment) => {
          const type = typesByKey.get(segment.event.type)
          return (
            <EventChip
              key={segment.event.id}
              segment={segment}
              title={segment.event.title || t('common.untitled')}
              category={type?.category ?? 'graphite'}
              allDay={segment.event.allDay}
              time={segment.continuesBefore ? undefined : segment.event.time}
              {...(segment.event.done === undefined ? {} : { done: segment.event.done })}
              onClick={() =>
                onOpenEvent(segment.event, days[segment.column]?.date ?? days[0]?.date ?? '')
              }
            />
          )
        })}
      </div>
    </div>
  )
}