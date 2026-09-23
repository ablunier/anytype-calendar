import { useTranslation } from 'react-i18next'
import type { CalendarView, IconName } from '@renderer/types'
import { Icon } from '@renderer/components/ui'

/** Shortest span first, so the three read as one scale widening to the right. */
const VIEWS: { view: CalendarView; icon: IconName }[] = [
  { view: 'day', icon: 'calendar' },
  { view: 'week', icon: 'columns-3' },
  { view: 'month', icon: 'calendar-days' }
]

export interface ViewSwitcherProps {
  view: CalendarView
  onChange: (view: CalendarView) => void
}

/** A segmented control, so all three views stay visible and one click apart. */
export function ViewSwitcher({ view, onChange }: ViewSwitcherProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div
      role="radiogroup"
      aria-label={t('calendar.nav.view')}
      className="flex shrink-0 items-center gap-2 rounded-8 border border-line-default bg-surface-rail p-2"
    >
      {VIEWS.map(({ view: candidate, icon }) => {
        const selected = candidate === view
        return (
          <button
            key={candidate}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(candidate)}
            className={[
              'flex h-control-sm items-center gap-6 rounded-6 px-10 type-caption text-tiny',
              'transition-colors duration-fast ease-standard',
              selected
                ? 'bg-surface-card text-ink-primary shadow-1'
                : 'text-ink-secondary hover:text-ink-body'
            ].join(' ')}
          >
            <Icon name={icon} size={12} />
            {t(`calendar.view.${candidate}`)}
          </button>
        )
      })}
    </div>
  )
}
