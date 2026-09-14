import type { CalendarEvent, ObjectType, Space } from '@renderer/types'
import { longDate } from '@renderer/lib/calendar'
import { ObjectRow } from './ObjectRow'

export interface DayDetailProps {
  /** `YYYY-MM-DD`. */
  date: string
  events: CalendarEvent[]
  typesByKey: Map<string, ObjectType>
  spacesByKey: Map<string, Space>
  onOpenEvent: (event: CalendarEvent) => void
}

export function DayDetail({
  date,
  events,
  typesByKey,
  spacesByKey,
  onOpenEvent
}: DayDetailProps): React.JSX.Element {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="px-16 pt-16 pb-8">
        <h2 className="mb-2 type-heading text-h4 text-ink-primary">{longDate(date)}</h2>
        <span className="type-numeral text-tiny text-ink-tertiary">{events.length} objects</span>
      </div>
      <div className="overflow-auto px-8 pb-16">
        {events.map((event) => {
          const type = typesByKey.get(event.type)
          const space = spacesByKey.get(event.space)
          return (
            <ObjectRow
              key={event.id}
              title={event.title}
              time={event.date === date ? event.time : undefined}
              typeLabel={type?.label}
              category={type?.category ?? 'graphite'}
              relation={space?.name}
              done={event.done}
              onClick={() => onOpenEvent(event)}
            />
          )
        })}
      </div>
    </div>
  )
}
