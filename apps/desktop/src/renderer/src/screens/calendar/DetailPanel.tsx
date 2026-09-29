import { useTranslation } from 'react-i18next'
import type { CalendarEvent, DetailTarget, ObjectType, Space } from '@renderer/types'
import { IconButton } from '@renderer/components/ui'
import { eventsOnDay } from '@renderer/lib/calendar'
import { DayDetail } from './DayDetail'
import { EventDetail } from './EventDetail'

export interface DetailPanelProps {
  detail: DetailTarget
  events: CalendarEvent[]
  typesByKey: Map<string, ObjectType>
  spacesByKey: Map<string, Space>
  /** Why the calendar cannot write to Anytype; null when it can. */
  readOnlyReason: string | null
  onClose: () => void
  onOpenEvent: (event: CalendarEvent) => void
  onSetDone: (event: CalendarEvent, done: boolean) => void
}

export function DetailPanel({
  detail,
  events,
  typesByKey,
  spacesByKey,
  readOnlyReason,
  onClose,
  onOpenEvent,
  onSetDone
}: DetailPanelProps): React.JSX.Element {
  const { t } = useTranslation()
  /* The event as it is now, not as it was when opened: ticked, moved, or read again since. It
   * is kept as opened once the span no longer holds it, e.g. after a move out of the span. */
  const event =
    detail.kind === 'event'
      ? (events.find(({ id, space }) => id === detail.event.id && space === detail.event.space) ?? detail.event)
      : null
  return (
    <aside
      aria-label={
        detail.kind === 'event' ? t('calendar.detailPanel.eventDetailLabel') : t('calendar.detailPanel.dayDetailLabel')
      }
      className="flex w-panel shrink-0 flex-col border-l border-line-subtle bg-surface-card"
    >
      <div className="flex h-topbar shrink-0 items-center justify-end border-b border-line-subtle pr-12 pl-16">
        <IconButton icon="x" label={t('calendar.detailPanel.close')} onClick={onClose} />
      </div>

      {event ? (
        <EventDetail
          event={event}
          type={typesByKey.get(event.type)}
          spacesByKey={spacesByKey}
          readOnlyReason={readOnlyReason}
          onSetDone={(done) => onSetDone(event, done)}
        />
      ) : detail.kind === 'day' ? (
        <DayDetail
          date={detail.date}
          events={eventsOnDay(events, detail.date)}
          typesByKey={typesByKey}
          onOpenEvent={onOpenEvent}
        />
      ) : null}
    </aside>
  )
}
