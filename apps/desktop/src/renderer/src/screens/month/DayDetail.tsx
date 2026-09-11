import type { CalendarEvent, ObjectType, Space } from '@renderer/types'
import { dateLabel, longDate } from '@renderer/lib/calendar'
import { ObjectRow } from './ObjectRow'

export interface DayDetailProps {
  day: number
  events: CalendarEvent[]
  typesByKey: Map<string, ObjectType>
  spacesByKey: Map<string, Space>
  year: number
  month: number
  onOpenEvent: (event: CalendarEvent) => void
}

export function DayDetail({
  day,
  events,
  typesByKey,
  spacesByKey,
  year,
  month,
  onOpenEvent
}: DayDetailProps): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="px-16 pt-16 pb-8">
        <h2 className="mb-2 type-heading text-h4 text-ink-primary">{longDate(year, month, day)}</h2>
        <span className="type-numeral text-tiny text-ink-tertiary">{events.length} objects</span>
      </div>
      <div className="overflow-auto px-8 pb-16">
        {events.map((event) => {
          const type = typesByKey.get(event.type)
          const space = type ? spacesByKey.get(type.space) : undefined
          return (
            <ObjectRow
              key={event.id}
              title={event.title}
              time={event.time}
              typeLabel={type?.label}
              category={type?.category ?? 'graphite'}
              relation={space && type ? `${space.name} · ${dateLabel(type, type.from)}` : undefined}
              done={event.done}
              onClick={() => onOpenEvent(event)}
            />
          )
        })}
      </div>
    </div>
  )
}
