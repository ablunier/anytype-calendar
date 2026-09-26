import { useTranslation } from 'react-i18next'
import type { CalendarEvent, ObjectType } from '@renderer/types'
import { eventHue, longDate } from '@renderer/lib/calendar'
import { EventRow } from './EventRow'

export interface DayDetailProps {
  /** `YYYY-MM-DD`. */
  date: string
  events: CalendarEvent[]
  typesByKey: Map<string, ObjectType>
  onOpenEvent: (event: CalendarEvent) => void
}

export function DayDetail({
  date,
  events,
  typesByKey,
  onOpenEvent
}: DayDetailProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  return (
    <div className="flex min-h-0 flex-col">
      <div className="px-16 pt-16 pb-8">
        <h2 className="mb-2 type-heading text-h4 text-ink-primary">
          {longDate(date, i18n.language)}
        </h2>
        <span className="type-numeral text-tiny text-ink-tertiary">
          {t('calendar.dayDetail.eventCount', { count: events.length })}
        </span>
      </div>
      <div className="overflow-auto px-8 pb-16">
        {events.map((event) => {
          const type = typesByKey.get(event.type)
          return (
            <EventRow
              key={event.id}
              title={event.title || t('common.untitled')}
              time={event.date === date ? event.time : undefined}
              category={eventHue(event, type)}
              done={event.done}
              onClick={() => onOpenEvent(event)}
            />
          )
        })}
      </div>
    </div>
  )
}
