import { useTranslation } from 'react-i18next'
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
  const { i18n } = useTranslation()
  const timeFormat = useTimeFormatValue()
  return (
    <div className="flex flex-col gap-2">
      {time ? (
        <span className="type-numeral text-small text-ink-body">
          {formatTime(time, timeFormat, i18n.language)}
        </span>
      ) : null}
      <span className="type-numeral text-small text-ink-body">{shortDate(date, i18n.language)}</span>
      <span className="type-caption text-tiny text-ink-tertiary">{caption}</span>
    </div>
  )
}

interface DetailToggleProps {
  checked: boolean
  label: string
  /** Left off for a read-only toggle. */
  onChange?: (checked: boolean) => void
}

/** A switch; read-only unless it is given `onChange`. */
function DetailToggle({ checked, label, onChange }: DetailToggleProps): React.JSX.Element {
  const track = (
    <span
      className={[
        'flex h-18 w-30 shrink-0 items-center rounded-pill p-2',
        'transition-colors duration-fast ease-standard',
        checked ? 'justify-end bg-surface-accent' : 'justify-start bg-surface-sunken border border-line-strong'
      ].join(' ')}
    >
      <span className="size-icon-14 rounded-pill bg-surface-card shadow-1" />
    </span>
  )
  const text = <span className="type-ui text-small text-ink-body">{label}</span>
  if (!onChange) {
    return (
      <div role="switch" aria-checked={checked} aria-readonly aria-label={label} className="flex items-center gap-10">
        {track}
        {text}
      </div>
    )
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-10 rounded-control text-left"
    >
      {track}
      {text}
    </button>
  )
}

export interface EventDetailProps {
  event: CalendarEvent
  type: ObjectType | undefined
  spacesByKey: Map<string, Space>
  /** Why this panel cannot write to Anytype; null when it can. */
  readOnlyReason: string | null
  onSetDone: (done: boolean) => void
}

/**
 * Every date names the relation that surfaced it ("Due date") — the system's rule that
 * trust comes from being explicit about why something is on the grid.
 */
export function EventDetail({
  event,
  type,
  spacesByKey,
  readOnlyReason,
  onSetDone
}: EventDetailProps): React.JSX.Element {
  const { t } = useTranslation()
  const space = spacesByKey.get(event.space)

  return (
    <div className="flex flex-col gap-16 overflow-auto px-16 py-20">
      <div className="flex flex-col gap-8">
        <h2 className="type-heading text-h4 text-pretty text-ink-primary">
          {event.title || t('common.untitled')}
        </h2>
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
              caption={type ? dateLabel(type, type.from) : t('calendar.eventDetail.fromDateFallback')}
            />
            {event.until ? (
              <>
                <Icon name="chevron-right" size={12} className="mt-4 shrink-0 text-ink-tertiary" />
                <DetailDate
                  date={event.until}
                  time={!event.allDay ? (event.end ?? event.time) : undefined}
                  caption={type?.to ? dateLabel(type, type.to) : t('calendar.eventDetail.toDateFallback')}
                />
              </>
            ) : null}
          </div>
        </div>

        {event.location ? (
          <div className="flex items-start gap-10">
            <Icon name="map-pin" size={16} className="mt-2 text-ink-tertiary" />
            <span className="sr-only">{t('calendar.eventDetail.location')}</span>
            <span className="type-body text-small text-pretty text-ink-body">{event.location}</span>
          </div>
        ) : null}

        {/* How a type is drawn is the user's choice in Settings, not the object's. */}
        <DetailToggle checked={event.allDay} label={t('calendar.eventDetail.allDay')} />
        {/* A read-only Done needs no tooltip of its own: the notice below says why. */}
        {event.done === undefined ? null : (
          <DetailToggle
            checked={event.done}
            label={t('calendar.eventDetail.done')}
            {...(readOnlyReason === null ? { onChange: onSetDone } : {})}
          />
        )}
      </div>

      <p className="flex items-start gap-8 rounded-8 bg-surface-sunken px-12 py-10">
        <Icon name="info" size={14} className="mt-2 text-ink-tertiary" />
        <span className="type-caption text-tiny text-ink-secondary">
          {readOnlyReason === null
            ? t('calendar.eventDetail.editNotice')
            : `${readOnlyReason} ${t('calendar.eventDetail.readOnlyNotice')}`}
        </span>
      </p>

      <Button
        variant="secondary"
        size="md"
        fullWidth
        iconRight="external-link"
        onClick={() => window.api.shell.openObject(event.id, event.space)}
      >
        {t('calendar.eventDetail.openInAnytype')}
      </Button>
    </div>
  )
}
