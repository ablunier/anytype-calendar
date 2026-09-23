import { useTranslation } from 'react-i18next'
import type { CategoryHue } from '@renderer/types'
import { catBg } from '@renderer/components/ui'
import { useTimeFormatValue } from '@renderer/hooks/TimeFormatContext'
import { formatTime } from '@renderer/lib/calendar'

export interface EventRowProps {
  title: string
  category: CategoryHue
  time?: string
  done?: boolean
  selected?: boolean
  onClick: () => void
}

export function EventRow({
  title,
  category,
  time,
  done = false,
  selected = false,
  onClick
}: EventRowProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const timeFormat = useTimeFormatValue()
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex min-h-40 w-full items-center gap-10 rounded-8 px-10 py-6 text-left',
        'transition-colors duration-fast ease-standard',
        selected ? 'bg-surface-selected' : 'hover:bg-surface-hover'
      ].join(' ')}
    >
      <span
        className={[
          'w-64 shrink-0 font-mono text-tiny tabular-nums',
          time ? 'text-ink-secondary' : 'text-ink-tertiary'
        ].join(' ')}
      >
        {time ? formatTime(time, timeFormat, i18n.language) : t('calendar.eventRow.allDay')}
      </span>
      <span aria-hidden className={['size-6 shrink-0 rounded-pill', catBg[category]].join(' ')} />
      <span
        className={[
          'min-w-0 flex-1 truncate type-body text-small text-ink-body',
          done ? 'line-through opacity-60' : ''
        ].join(' ')}
      >
        {title}
      </span>
    </button>
  )
}
