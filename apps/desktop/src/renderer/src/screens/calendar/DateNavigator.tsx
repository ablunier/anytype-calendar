import { useTranslation } from 'react-i18next'
import type { Space } from '@renderer/types'
import { SpaceMonogram } from '@renderer/components/app/SpaceMonogram'
import { Button, IconButton } from '@renderer/components/ui'

export interface DateNavigatorProps {
  title: string
  legendSpaces: Space[]
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

export function DateNavigator({
  title,
  legendSpaces,
  onPrev,
  onNext,
  onToday
}: DateNavigatorProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-16 border-b border-line-subtle bg-surface-card px-16 py-10">
      <div className="flex items-center gap-2">
        <IconButton icon="chevron-left" label={t('calendar.nav.prevMonth')} onClick={onPrev} />
        <IconButton icon="chevron-right" label={t('calendar.nav.nextMonth')} onClick={onNext} />
      </div>

      <h1 className="shrink-0 whitespace-nowrap type-heading text-h4 text-ink-primary">{title}</h1>

      <Button size="sm" iconLeft="calendar-check" onClick={onToday}>
        {t('calendar.nav.today')}
      </Button>

      <div className="flex-1" />

      {/* The legend is the one part of this row that may be trimmed: without min-w-0 it
          refuses to shrink and pushes the whole app into a horizontal scroll. */}
      <ul className="flex min-w-0 list-none items-center gap-12 overflow-hidden p-0">
        {legendSpaces.map((space) => (
          <li
            key={space.key}
            className="flex shrink-0 items-center gap-6 type-caption text-tiny text-ink-secondary"
          >
            <SpaceMonogram space={space} />
            {space.name}
          </li>
        ))}
      </ul>
    </div>
  )
}
