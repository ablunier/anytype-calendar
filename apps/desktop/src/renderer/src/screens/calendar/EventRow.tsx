import { catBg, Icon } from '@renderer/components/ui'
import { useTimeFormatValue } from '@renderer/hooks/TimeFormatContext'
import { formatTime } from '@renderer/lib/calendar'
import type { CategoryHue } from '@renderer/types'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export interface EventRowProps {
  title: string
  category: CategoryHue
  time?: string
  /**
   * Drawn in the time column instead of `time`, already formatted, in a column wide enough
   * for a start and an end.
   */
  timeText?: string
  /** Drawn after the title, e.g. which day of a range the row is. */
  note?: string
  /** A second line under the title. */
  subtitle?: ReactNode
  done?: boolean
  /** Drawn faded, e.g. an object that is already over. */
  dimmed?: boolean
  /** An event of a subscribed calendar, marked apart from Anytype's objects. */
  external?: boolean
  selected?: boolean
  onClick: () => void
}

export function EventRow({
  title,
  category,
  time,
  timeText,
  note,
  subtitle,
  done = false,
  dimmed = false,
  external = false,
  selected = false,
  onClick,
}: EventRowProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const timeFormat = useTimeFormatValue()
  const timed = timeText !== undefined || time !== undefined
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex min-h-40 w-full items-center gap-10 rounded-8 px-10 py-6 text-left',
        'transition-colors duration-fast ease-standard',
        selected ? 'bg-surface-selected' : 'hover:bg-surface-hover',
        dimmed ? 'opacity-60' : '',
      ].join(' ')}
    >
      <span
        className={[
          'shrink-0 font-mono text-tiny tabular-nums',
          timeText === undefined ? 'w-64' : 'w-116',
          timed ? 'text-ink-secondary' : 'text-ink-tertiary',
        ].join(' ')}
      >
        {timeText ?? (time ? formatTime(time, timeFormat, i18n.language) : t('calendar.eventRow.allDay'))}
      </span>
      <span aria-hidden className={['size-6 shrink-0 rounded-pill', catBg[category]].join(' ')} />
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex min-w-0 items-baseline gap-6">
          <span
            className={[
              'min-w-0 truncate type-body text-small text-ink-body',
              done ? 'line-through opacity-60' : '',
            ].join(' ')}
          >
            {title}
          </span>
          {note ? <span className="shrink-0 type-caption text-tiny text-ink-tertiary">{note}</span> : null}
        </span>
        {subtitle}
      </span>
      {external ? <Icon name="rss" size={12} className="shrink-0 text-ink-tertiary" /> : null}
    </button>
  )
}
