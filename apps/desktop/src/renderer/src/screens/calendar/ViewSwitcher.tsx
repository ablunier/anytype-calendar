import { Icon } from '@renderer/components/ui'
import type { CalendarView, IconName } from '@renderer/types'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

/** Shortest span first, so the three read as one scale widening to the right. */
const VIEWS: { view: CalendarView; icon: IconName }[] = [
  { view: 'day', icon: 'calendar' },
  { view: 'week', icon: 'columns-3' },
  { view: 'month', icon: 'calendar-days' },
]

export interface ViewSwitcherProps {
  view: CalendarView
  onChange: (view: CalendarView) => void
}

/**
 * A segmented control, so all three views stay visible and one click apart. Native radios
 * give it one tab stop and the arrow keys between views.
 */
export function ViewSwitcher({ view, onChange }: ViewSwitcherProps): React.JSX.Element {
  const { t } = useTranslation()
  const name = useId()
  return (
    <div
      role="radiogroup"
      aria-label={t('calendar.nav.view')}
      className="flex shrink-0 items-center gap-2 rounded-8 border border-line-default bg-surface-rail p-2"
    >
      {VIEWS.map(({ view: candidate, icon }) => {
        const selected = candidate === view
        return (
          <label
            key={candidate}
            className={[
              'relative flex h-control-sm cursor-default items-center gap-6 rounded-6 px-10 type-caption text-tiny select-none',
              'transition-colors duration-fast ease-standard',
              'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus-ring',
              selected ? 'bg-surface-card text-ink-primary shadow-1' : 'text-ink-secondary hover:text-ink-body',
            ].join(' ')}
          >
            <input
              type="radio"
              name={name}
              checked={selected}
              onChange={() => onChange(candidate)}
              className="sr-only"
            />
            <Icon name={icon} size={12} />
            {t(`calendar.view.${candidate}`)}
          </label>
        )
      })}
    </div>
  )
}
