import { useTranslation } from 'react-i18next'
import type { EventsRescheduleRequest } from '@shared/ipc'
import type { CalendarEvent, ObjectType, Space } from '@renderer/types'
import { SpaceMonogram } from '@renderer/components/app/SpaceMonogram'
import { Button, Icon, Tag } from '@renderer/components/ui'
import { useTimeFormatValue } from '@renderer/hooks/TimeFormatContext'
import { dateLabel, formatTime, shortDate } from '@renderer/lib/calendar'
import {
  addEndRequestFor,
  clearEndRequestFor,
  endRequestFor,
  hasOwnEnd,
  startRequestFor
} from '@renderer/lib/events'
import { DateField, type DateFieldProps } from './DateField'
import { TimeField } from './TimeField'

/** What the date pickers follow. */
export type DatePickerSettings = Pick<DateFieldProps, 'today' | 'weekStart' | 'showWeekNumbers'>

interface DateEdit {
  picker: DatePickerSettings
  /** `YYYY-MM-DD`; the days before it cannot be picked. */
  min?: string
  /** `date` is `YYYY-MM-DD`. */
  onDate: (date: string) => void
  /** `time` is `HH:MM`. */
  onTime: (time: string) => void
}

interface DetailDateProps {
  date: string
  /** Absent for an all-day event, so the date sits alone at the top of the column. */
  time?: string
  caption: string
  /** Left off where the date cannot be written. */
  edit?: DateEdit
}

/**
 * Time, date and caption stack in one column so a From/To pair lines up: two side-by-side
 * flex rows (a time row above a date row) don't share column widths on their own, since
 * each row's cells size to that row's own content.
 */
function DetailDate({ date, time, caption, edit }: DetailDateProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const timeFormat = useTimeFormatValue()
  if (edit) {
    const { picker, min, onDate, onTime } = edit
    return (
      <div className="flex flex-col items-start gap-4">
        {time ? (
          <TimeField value={time} label={t('calendar.eventDetail.timeOf', { caption })} onCommit={onTime} />
        ) : null}
        <DateField value={date} label={caption} {...picker} {...(min === undefined ? {} : { min })} onChange={onDate} />
        <span className="type-caption text-tiny text-ink-tertiary">{caption}</span>
      </div>
    )
  }
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
  picker: DatePickerSettings
  onSetDone: (done: boolean) => void
  onReschedule: (request: EventsRescheduleRequest) => void
  /** Given while none of its dates is on screen: opens the view on its From date. */
  onGoToDate?: () => void
}

/**
 * Every date names the relation that surfaced it ("Due date") — the system's rule that
 * trust comes from being explicit about why something is on the grid.
 *
 * Where it can write, From and To are fields that write as each is set, as Settings saves
 * each change: From moves the object, keeping its length, and To moves its end alone, never
 * to before From. Where the type has a To apart from its From, the end can be added or
 * removed.
 */
export function EventDetail({
  event,
  type,
  spacesByKey,
  readOnlyReason,
  picker,
  onSetDone,
  onReschedule,
  onGoToDate
}: EventDetailProps): React.JSX.Element {
  const { t } = useTranslation()
  const space = spacesByKey.get(event.space)
  const editable = readOnlyReason === null
  const ownEnd = type !== undefined && hasOwnEnd(type)
  const { date, time, until } = event
  const endTime = event.end ?? time

  const startEdit: DateEdit | undefined = editable
    ? {
        picker,
        onDate: (moved) => onReschedule(startRequestFor(event, moved)),
        onTime: (moved) => onReschedule(startRequestFor(event, date, moved))
      }
    : undefined
  const endEdit: DateEdit | undefined =
    editable && ownEnd && until !== undefined
      ? {
          picker,
          min: date,
          onDate: (moved) => onReschedule(endRequestFor(event, moved)),
          onTime: (moved) => {
            // `HH:MM` compares in order as a string; the field goes back to the saved time.
            if (until === date && time !== undefined && moved < time) return
            onReschedule(endRequestFor(event, until, moved))
          }
        }
      : undefined

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
          <div className="flex flex-col items-start gap-8">
            <div className="flex items-start gap-16">
              <DetailDate
                date={date}
                time={!event.allDay ? time : undefined}
                caption={type ? dateLabel(type, type.from) : t('calendar.eventDetail.fromDateFallback')}
                {...(startEdit ? { edit: startEdit } : {})}
              />
              {until ? (
                <>
                  <Icon name="chevron-right" size={12} className="mt-4 shrink-0 text-ink-tertiary" />
                  <DetailDate
                    date={until}
                    time={!event.allDay ? endTime : undefined}
                    caption={type?.to ? dateLabel(type, type.to) : t('calendar.eventDetail.toDateFallback')}
                    {...(endEdit ? { edit: endEdit } : {})}
                  />
                </>
              ) : null}
            </div>
            {editable && ownEnd ? (
              until ? (
                <Button variant="ghost" size="sm" iconLeft="minus" onClick={() => onReschedule(clearEndRequestFor(event))}>
                  {t('calendar.eventDetail.removeEnd')}
                </Button>
              ) : (
                <Button variant="ghost" size="sm" iconLeft="plus" onClick={() => onReschedule(addEndRequestFor(event))}>
                  {t('calendar.eventDetail.addEnd')}
                </Button>
              )
            ) : null}
            {onGoToDate ? (
              <Button variant="quiet" size="sm" iconRight="arrow-up-right" onClick={onGoToDate}>
                {t('calendar.eventDetail.goToDate')}
              </Button>
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
        <div className="flex flex-col gap-4">
          <DetailToggle checked={event.allDay} label={t('calendar.eventDetail.allDay')} />
          <span className="type-caption text-tiny text-ink-tertiary">{t('calendar.eventDetail.allDayHint')}</span>
        </div>
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
