import { useTranslation } from 'react-i18next'
import type { CalendarView } from '@renderer/types'
import { Button, IconButton } from '@renderer/components/ui'
import { ViewSwitcher } from './ViewSwitcher'

export interface DateNavigatorProps {
  title: string
  view: CalendarView
  onView: (view: CalendarView) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

export function DateNavigator({
  title,
  view,
  onView,
  onPrev,
  onNext,
  onToday
}: DateNavigatorProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-16 border-b border-line-subtle bg-surface-card px-16 py-10">
      <div className="flex items-center gap-2">
        <IconButton icon="chevron-left" label={t(`calendar.nav.prev.${view}`)} onClick={onPrev} />
        <IconButton icon="chevron-right" label={t(`calendar.nav.next.${view}`)} onClick={onNext} />
      </div>

      <h1 className="min-w-0 truncate type-heading text-h4 text-ink-primary">{title}</h1>

      <div className="flex-1" />

      <Button size="sm" iconLeft="calendar-check" onClick={onToday}>
        {t('calendar.nav.today')}
      </Button>

      <ViewSwitcher view={view} onChange={onView} />
    </div>
  )
}
