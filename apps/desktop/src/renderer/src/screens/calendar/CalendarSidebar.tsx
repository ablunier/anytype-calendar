import { useTranslation } from 'react-i18next'
import type { ObjectType, Space } from '@renderer/types'
import { IconButton } from '@renderer/components/ui'
import { MiniMonth, type MiniMonthProps } from './MiniMonth'
import { SourceTree } from './SourceTree'

export interface CalendarSidebarProps extends MiniMonthProps {
  collapsed: boolean
  spaces: Space[]
  sources: ObjectType[]
  hidden: ReadonlySet<string>
  onSetShown: (keys: string[], shown: boolean) => void
  onToggleCollapsed: () => void
}

/**
 * On the left of the calendar: a mini month, then what the calendar holds, each of which can
 * be hidden. Collapsed, only the button that opens it again remains.
 */
export function CalendarSidebar({
  collapsed,
  spaces,
  sources,
  hidden,
  onSetShown,
  onToggleCollapsed,
  ...miniMonth
}: CalendarSidebarProps): React.JSX.Element {
  const { t } = useTranslation()
  if (collapsed) {
    return (
      <aside
        aria-label={t('calendar.sidebar.label')}
        className="flex w-40 shrink-0 flex-col items-center border-r border-line-subtle bg-surface-card py-8"
      >
        <IconButton icon="panel-left-open" label={t('calendar.sidebar.expand')} onClick={onToggleCollapsed} />
      </aside>
    )
  }
  return (
    <aside
      aria-label={t('calendar.sidebar.label')}
      className="flex w-240 shrink-0 flex-col gap-16 overflow-y-auto border-r border-line-subtle bg-surface-card p-12"
    >
      <div className="flex justify-end">
        <IconButton size="sm" icon="panel-left-close" label={t('calendar.sidebar.collapse')} onClick={onToggleCollapsed} />
      </div>
      <MiniMonth {...miniMonth} />
      <div className="flex flex-col gap-8">
        <h2 className="type-overline text-micro text-ink-tertiary">{t('calendar.sidebar.calendars')}</h2>
        {/* Each source of objects is a group of its own; Anytype's is a product name, left untranslated. */}
        <section aria-labelledby="sidebar-group-anytype" className="flex flex-col gap-4">
          <h3 id="sidebar-group-anytype" className="m-0 px-4 type-ui text-small text-ink-secondary">
            Anytype
          </h3>
          <SourceTree spaces={spaces} sources={sources} hidden={hidden} onSetShown={onSetShown} />
        </section>
      </div>
    </aside>
  )
}
