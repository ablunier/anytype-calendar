import type { CalendarEvent, ObjectType, Space } from '@renderer/types'
import { SpaceMonogram } from '@renderer/components/app/SpaceMonogram'
import { Button, Icon, Tag } from '@renderer/components/ui'
import { dateLabel } from '@renderer/lib/calendar'

interface DetailFieldProps {
  label: string
  value: string
  mono?: boolean
}

function DetailField({ label, value, mono = false }: DetailFieldProps): React.JSX.Element {
  return (
    <div className="flex items-baseline gap-12">
      <dt className="w-116 shrink-0 type-caption text-tiny text-ink-tertiary">{label}</dt>
      <dd
        className={[
          'min-w-0 flex-1 text-small text-ink-body',
          mono ? 'type-numeral' : 'type-ui'
        ].join(' ')}
      >
        {value}
      </dd>
    </div>
  )
}

export interface EventDetailProps {
  event: CalendarEvent
  type: ObjectType | undefined
  spacesByKey: Map<string, Space>
}

/**
 * Every field names the relation that surfaced it ("From · Due date") — the system's rule
 * that trust comes from being explicit about why something is on the grid.
 */
export function EventDetail({ event, type, spacesByKey }: EventDetailProps): React.JSX.Element {
  const space = spacesByKey.get(event.space)
  const from = `${event.date}${event.time ? ` ${event.time}` : ''}`
  const to = event.until ? `${event.until}${event.end ? ` ${event.end}` : ''}` : 'Not set'

  return (
    <div className="flex flex-col gap-16 overflow-auto px-16 py-20">
      <div className="flex flex-col gap-8">
        <h2 className="type-heading text-h4 text-pretty text-ink-primary">{event.title}</h2>
        <div className="flex items-center gap-8">
          {type ? (
            <Tag category={type.category} icon={type.icon}>
              {type.label}
            </Tag>
          ) : null}
          {space ? (
            <span className="flex items-center gap-6 type-caption text-tiny text-ink-secondary">
              <SpaceMonogram space={space} />
              {space.name}
            </span>
          ) : null}
        </div>
      </div>

      <dl className="flex flex-col gap-10 border-t border-line-hairline pt-16">
        <DetailField label={`From · ${type ? dateLabel(type, type.from) : 'date'}`} value={from} mono />
        <DetailField
          label={type?.to ? `To · ${dateLabel(type, type.to)}` : 'To date'}
          value={to}
          mono={event.until !== undefined}
        />
        <DetailField label="All day" value={event.allDay ? 'Yes' : 'No'} />
        <DetailField label="Space" value={space?.name ?? 'Unknown'} />
      </dl>

      <p className="flex items-start gap-8 rounded-8 bg-surface-sunken px-12 py-10">
        <Icon name="info" size={14} className="mt-2 text-ink-tertiary" />
        <span className="type-caption text-tiny text-ink-secondary">
          This view is read-only. Edit the object in Anytype and it updates here on the next
          read.
        </span>
      </p>

      <Button variant="secondary" size="md" fullWidth iconRight="external-link">
        Open in Anytype
      </Button>
    </div>
  )
}
