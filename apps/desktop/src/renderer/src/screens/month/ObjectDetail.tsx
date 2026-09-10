import type { CalendarEvent, ObjectType, Space } from '../../types'
import { SpaceDot } from '../../components/app/SpaceDot'
import { Button, Icon, Tag } from '../../components/ui'
import { isoDate } from '../../lib/calendar'

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

export interface ObjectDetailProps {
  event: CalendarEvent
  type: ObjectType | undefined
  spacesByKey: Map<string, Space>
  year: number
  month: number
}

/**
 * One object, read-only.
 *
 * Every field names the relation that surfaced it ("From · Due date") — the system's rule
 * that trust comes from being explicit about why something is on the grid.
 */
export function ObjectDetail({
  event,
  type,
  spacesByKey,
  year,
  month
}: ObjectDetailProps): React.JSX.Element {
  const space = type ? spacesByKey.get(type.space) : undefined
  const from = `${isoDate(year, month, event.day)}${event.time ? ` ${event.time}` : ''}`
  const to = type?.to
    ? `${isoDate(year, month, event.until ?? event.day)}${event.end ? ` ${event.end}` : ''}`
    : 'Not set'

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
              <SpaceDot space={space} size={6} />
              {space.name}
            </span>
          ) : null}
        </div>
      </div>

      <dl className="flex flex-col gap-10 border-t border-line-hairline pt-16">
        <DetailField label={`From · ${type?.from ?? 'date'}`} value={from} mono />
        <DetailField label={type?.to ? `To · ${type.to}` : 'To date'} value={to} mono={!!type?.to} />
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
