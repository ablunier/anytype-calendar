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
  onClose: () => void
  onOpenEvent: (event: CalendarEvent) => void
}

export function DetailPanel({
  detail,
  events,
  typesByKey,
  spacesByKey,
  onClose,
  onOpenEvent
}: DetailPanelProps): React.JSX.Element {
  const { t } = useTranslation()
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

      {detail.kind === 'event' ? (
        <EventDetail
          event={detail.event}
          type={typesByKey.get(detail.event.type)}
          spacesByKey={spacesByKey}
        />
      ) : (
        <DayDetail
          date={detail.date}
          events={eventsOnDay(events, detail.date)}
          typesByKey={typesByKey}
          onOpenEvent={onOpenEvent}
        />
      )}
    </aside>
  )
}
