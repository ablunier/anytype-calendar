import type { CalendarEvent, DetailTarget, ObjectType, Space } from '@renderer/types'
import { IconButton } from '@renderer/components/ui'
import { eventsOnDay } from '@renderer/lib/calendar'
import { DayDetail } from './DayDetail'
import { ObjectDetail } from './ObjectDetail'

export interface DetailPanelProps {
  detail: DetailTarget
  events: CalendarEvent[]
  typesByKey: Map<string, ObjectType>
  spacesByKey: Map<string, Space>
  year: number
  month: number
  onClose: () => void
  onOpenEvent: (event: CalendarEvent) => void
}

export function DetailPanel({
  detail,
  events,
  typesByKey,
  spacesByKey,
  year,
  month,
  onClose,
  onOpenEvent
}: DetailPanelProps): React.JSX.Element {
  return (
    <aside
      aria-label={detail.kind === 'object' ? 'Object detail' : 'Day detail'}
      className="flex w-panel shrink-0 flex-col border-l border-line-subtle bg-surface-card"
    >
      <div className="flex h-topbar shrink-0 items-center gap-8 border-b border-line-subtle pr-12 pl-16">
        <span className="type-overline text-tiny text-ink-tertiary">
          {detail.kind === 'object' ? 'Object' : 'Day'}
        </span>
        <div className="flex-1" />
        <IconButton icon="x" label="Close panel" onClick={onClose} />
      </div>

      {detail.kind === 'object' ? (
        <ObjectDetail
          event={detail.event}
          type={typesByKey.get(detail.event.type)}
          spacesByKey={spacesByKey}
          year={year}
          month={month}
        />
      ) : (
        <DayDetail
          day={detail.day}
          events={eventsOnDay(events, detail.day)}
          typesByKey={typesByKey}
          spacesByKey={spacesByKey}
          year={year}
          month={month}
          onOpenEvent={onOpenEvent}
        />
      )}
    </aside>
  )
}
