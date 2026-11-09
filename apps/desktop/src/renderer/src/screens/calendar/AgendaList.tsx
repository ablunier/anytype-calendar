import { TypeTile } from '@renderer/components/app/TypeTile'
import { Icon } from '@renderer/components/ui'
import { useTimeFormatValue } from '@renderer/hooks/TimeFormatContext'
import type { AgendaDay, AgendaRow, AgendaTime } from '@renderer/lib/agenda'
import { addDays, eventHue, formatTime, shortDate } from '@renderer/lib/calendar'
import type { CalendarEvent, ObjectType, Space } from '@renderer/types'
import type { TFunction } from 'i18next'
import { useEffect, useEffectEvent, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { EventRow } from './EventRow'

export interface AgendaListProps {
  /** Built by `buildAgenda`. */
  days: AgendaDay[]
  /** `YYYY-MM-DD`: the agenda's first day, which need not be listed. */
  start: string
  /** `YYYY-MM-DD`. */
  today: string
  typesByKey: Map<string, ObjectType>
  spacesByKey: Map<string, Space>
  /** `YYYY-MM-DD` of the day whose panel is open, if any. */
  selectedDate: string | null
  /** `date` is the day the row was clicked on, `YYYY-MM-DD`. */
  onOpenEvent: (event: CalendarEvent, date: string) => void
  onSelectDay: (date: string) => void
}

/**
 * The agenda's days, each under a header pinned while its rows scroll by. Takes only what it
 * draws and the callbacks, not the screen around it, so other windows can reuse it.
 */
export function AgendaList({
  days,
  start,
  today,
  typesByKey,
  spacesByKey,
  selectedDate,
  onOpenEvent,
  onSelectDay,
}: AgendaListProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const timeFormat = useTimeFormatValue()
  const scroller = useRef<HTMLDivElement>(null)
  const tomorrow = addDays(today, 1)

  /* Opened on today when the agenda starts before it, so the days already past are a scroll
   * up rather than in the way. Only when the agenda changes, never on a reread. */
  const scrollToToday = useEffectEvent((first: string) => {
    const header = first < today ? scroller.current?.querySelector<HTMLElement>('[data-today]') : null
    scroller.current?.scrollTo({ top: header ? header.offsetTop : 0 })
  })
  useEffect(() => scrollToToday(start), [start])

  const time = (value: TimedAgendaTime): string =>
    timeText(t, value, (hhmm) => formatTime(hhmm, timeFormat, i18n.language))

  return (
    <div ref={scroller} className="relative min-h-0 flex-1 overflow-auto">
      <ol aria-label={t('calendar.agenda.label')} className="mx-auto flex max-w-content-max flex-col px-16 pb-24">
        {days.map((day) => {
          const name =
            day.date === today
              ? t('calendar.agenda.today')
              : day.date === tomorrow
                ? t('calendar.agenda.tomorrow')
                : null
          return (
            <li key={day.date} data-today={day.isToday ? '' : undefined} className="flex flex-col">
              <h2 className="sticky top-0 z-10 bg-surface-page pt-16 pb-4">
                <button
                  type="button"
                  aria-current={day.isToday ? 'date' : undefined}
                  onClick={() => onSelectDay(day.date)}
                  className={[
                    'flex w-full items-baseline gap-8 rounded-6 px-10 py-4 text-left',
                    'transition-colors duration-fast ease-standard',
                    selectedDate === day.date ? 'bg-surface-selected' : 'hover:bg-surface-hover',
                  ].join(' ')}
                >
                  <span
                    className={['type-heading text-small', day.isToday ? 'text-today-ink' : 'text-ink-primary'].join(
                      ' ',
                    )}
                  >
                    {name ?? shortDate(day.date, i18n.language)}
                  </span>
                  {name ? (
                    <span className="type-caption text-tiny text-ink-secondary">
                      {shortDate(day.date, i18n.language)}
                    </span>
                  ) : null}
                  <span className="flex-1" />
                  {day.rows.length > 0 ? (
                    <span className="type-numeral text-tiny text-ink-tertiary">
                      {t('calendar.dayDetail.eventCount', { count: day.rows.length })}
                    </span>
                  ) : null}
                </button>
              </h2>
              {day.rows.length === 0 ? (
                <p className="px-10 py-6 type-body text-small text-ink-tertiary">
                  {t('calendar.agenda.nothingElseToday')}
                </p>
              ) : (
                <ul className="flex flex-col">
                  {day.rows.map((row, index) => (
                    <li key={`${row.event.space}:${row.event.id}`}>
                      {day.nowBefore === index ? <NowLine /> : null}
                      <EventRow
                        title={row.event.title || t('common.untitled')}
                        category={eventHue(row.event, typesByKey.get(row.event.type))}
                        {...(row.time.kind === 'all-day' ? {} : { timeText: time(row.time) })}
                        wideTime
                        {...(row.range
                          ? { note: t('calendar.agenda.rangeDay', { day: row.range.day, of: row.range.of }) }
                          : {})}
                        subtitle={<RowSubtitle row={row} typesByKey={typesByKey} spacesByKey={spacesByKey} />}
                        done={row.event.done}
                        dimmed={row.ended}
                        external={row.event.feed !== undefined}
                        onClick={() => onOpenEvent(row.event, day.date)}
                      />
                    </li>
                  ))}
                  {day.nowBefore === day.rows.length ? (
                    <li aria-hidden>
                      <NowLine />
                    </li>
                  ) : null}
                </ul>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** All-day rows are left to `EventRow`, which says so the way the day panel does. */
type TimedAgendaTime = Exclude<AgendaTime, { kind: 'all-day' }>

function timeText(t: TFunction, time: TimedAgendaTime, format: (hhmm: string) => string): string {
  switch (time.kind) {
    case 'until':
      return t('calendar.agenda.until', { time: format(time.end) })
    case 'at':
      return time.end === undefined ? format(time.start) : `${format(time.start)} – ${format(time.end)}`
  }
}

/** The type and space it was read through, or the subscribed calendar, then where it is. */
function RowSubtitle({
  row: { event },
  typesByKey,
  spacesByKey,
}: {
  row: AgendaRow
  typesByKey: Map<string, ObjectType>
  spacesByKey: Map<string, Space>
}): React.JSX.Element {
  const type = typesByKey.get(event.type)
  const space = spacesByKey.get(event.space)
  const source = event.feed ? event.feed.calendar : [type?.label, space?.name].filter(Boolean).join(' · ')
  return (
    <span className="flex min-w-0 items-center gap-6 type-caption text-tiny text-ink-tertiary">
      {type ? <TypeTile type={type} size="sm" /> : null}
      <span className="min-w-0 truncate">{source}</span>
      {event.location ? (
        <>
          <Icon name="map-pin" size={11} className="shrink-0" />
          <span className="min-w-0 truncate">{event.location}</span>
        </>
      ) : null}
    </span>
  )
}

function NowLine(): React.JSX.Element {
  return (
    <div aria-hidden className="relative mx-10 my-2 border-t border-today-ink">
      <span className="absolute -top-3 -left-3 size-6 rounded-pill bg-today-ink" />
    </div>
  )
}
