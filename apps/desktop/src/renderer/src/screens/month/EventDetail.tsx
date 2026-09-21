import type { CalendarEvent, ObjectType, Space } from '@renderer/types'
import { SpaceMonogram } from '@renderer/components/app/SpaceMonogram'
import { Button, Icon, Tag } from '@renderer/components/ui'
import { useTimeFormatValue } from '@renderer/hooks/TimeFormatContext'
import { dateLabel, formatTime, shortDate } from '@renderer/lib/calendar'

interface DetailDateProps {
  date: string
  /** Absent for an all-day event, so the date sits alone at the top of the column. */
  time?: string
  caption: string
}

/**
 * Time, date and caption stack in one column so a From/To pair lines up: two side-by-side
 * flex rows (a time row above a date row) don't share column widths on their own, since
 * each row's cells size to that row's own content.
 */
function DetailDate({ date, time, caption }: DetailDateProps): React.JSX.Element {
  const timeFormat = useTimeFormatValue()
  return (
    <div className="flex flex-col gap-2">
      {time ? <span className="type-numeral text-small text-ink-body">{formatTime(time, timeFormat)}</span> : null}
      <span className="type-numeral text-small text-ink-body">{shortDate(date)}</span>
      <span className="type-caption text-tiny text-ink-tertiary">{caption}</span>
    </div>
  )
}

interface ReadOnlyToggleProps {
  checked: boolean
  label: string
}

/** A read-only stand-in for a toggle switch: this panel never writes back to Anytype. */
function ReadOnlyToggle({ checked, label }: ReadOnlyToggleProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-10">
      <span
        role="switch"
        aria-checked={checked}
        aria-readonly
        className={[
          'flex h-18 w-30 shrink-0 items-center rounded-pill p-2',
          checked ? 'justify-end bg-surface-accent' : 'justify-start bg-surface-sunken border border-line-strong'
        ].join(' ')}
      >
        <span className="size-icon-14 rounded-pill bg-surface-card shadow-1" />
      </span>
      <span className="type-ui text-small text-ink-body">{label}</span>
    </div>
  )
}

export interface EventDetailProps {
  event: CalendarEvent
  type: ObjectType | undefined
  spacesByKey: Map<string, Space>
}

/**
 * Every date names the relation that surfaced it ("Due date") — the system's rule that
 * trust comes from being explicit about why something is on the grid.
 */
export function EventDetail({ event, type, spacesByKey }: EventDetailProps): React.JSX.Element {
  const space = spacesByKey.get(event.space)

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

      <div className="flex flex-col gap-16 border-t border-line-hairline pt-16">
        <div className="flex items-start gap-10">
          <Icon name="clock" size={16} className="mt-2 text-ink-tertiary" />
          <div className="flex items-start gap-16">
            <DetailDate
              date={event.date}
              time={!event.allDay ? event.time : undefined}
              caption={type ? dateLabel(type, type.from) : 'From date'}
            />
            {event.until ? (
              <>
                <Icon name="chevron-right" size={12} className="mt-4 shrink-0 text-ink-tertiary" />
                <DetailDate
                  date={event.until}
                  time={!event.allDay ? (event.end ?? event.time) : undefined}
                  caption={type?.to ? dateLabel(type, type.to) : 'To date'}
                />
              </>
            ) : null}
          </div>
        </div>

        <ReadOnlyToggle checked={event.allDay} label="All day" />
      </div>

      <p className="flex items-start gap-8 rounded-8 bg-surface-sunken px-12 py-10">
        <Icon name="info" size={14} className="mt-2 text-ink-tertiary" />
        <span className="type-caption text-tiny text-ink-secondary">
          This view is read-only. Edit the object in Anytype and it updates here on the next
          read.
        </span>
      </p>

      <Button
        variant="secondary"
        size="md"
        fullWidth
        iconRight="external-link"
        onClick={() => window.api.shell.openObject(event.id, event.space)}
      >
        Open in Anytype
      </Button>
    </div>
  )
}
