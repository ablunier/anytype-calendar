import { useTranslation } from 'react-i18next'
import type { EventsSpan } from '@anytype-calendar/events/domain'
import type { FeedSource, ObjectType, Space } from '@renderer/types'
import { IconButton } from '@renderer/components/ui'
import { anchorOf, spanDays } from '@renderer/lib/events'
import { MiniMonth } from './MiniMonth'
import { FeedList, SourceTree } from './SourceTree'

export interface CalendarSidebarProps {
  /**
   * What the main calendar draws: the mini month marks the days it covers and opens on it, and
   * since the screen is keyed by the span, starts over on it whenever that changes.
   */
  span: EventsSpan
  /** `YYYY-MM-DD`. */
  today: string
  weekStart: number
  showWeekNumbers: boolean
  /** `date` is `YYYY-MM-DD`. */
  onSelectDate: (date: string) => void
  collapsed: boolean
  spaces: Space[]
  sources: ObjectType[]
  /** The subscribed calendars, in the user's order. */
  feeds: FeedSource[]
  hidden: ReadonlySet<string>
  collapsedSpaces: ReadonlySet<string>
  onToggleSpaceCollapsed: (spaceKey: string) => void
  onSetShown: (keys: string[], shown: boolean) => void
  onToggleCollapsed: () => void
  /** Opens Settings at the subscribed calendars, to add one. */
  onAddCalendar: () => void
}

/**
 * On the left of the calendar: a mini month, then what the calendar holds — Anytype's spaces,
 * then the subscribed calendars — each of which can be hidden. Collapsed, only the button that opens it again remains.
 */
export function CalendarSidebar({
  collapsed,
  spaces,
  sources,
  feeds,
  hidden,
  collapsedSpaces,
  onToggleSpaceCollapsed,
  onSetShown,
  onToggleCollapsed,
  onAddCalendar,
  span,
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
      className="flex w-240 shrink-0 flex-col gap-16 overflow-hidden border-r border-line-subtle bg-surface-card p-12"
    >
      <div className="flex shrink-0 justify-end">
        <IconButton size="sm" icon="panel-left-close" label={t('calendar.sidebar.collapse')} onClick={onToggleCollapsed} />
      </div>
      <MiniMonth
        label={t('calendar.sidebar.miniMonth')}
        opensOn={anchorOf(span)}
        marked={spanDays(span)}
        {...miniMonth}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto">
        <div className="flex shrink-0 items-center justify-between">
          <h2 className="type-overline text-micro text-ink-tertiary">{t('calendar.sidebar.calendars')}</h2>
          <IconButton size="sm" icon="plus" label={t('calendar.sidebar.addCalendar')} onClick={onAddCalendar} />
        </div>
        {/* Each source of objects is a group of its own; Anytype's is a product name, left untranslated. */}
        <section aria-labelledby="sidebar-group-anytype" className="flex shrink-0 flex-col gap-4">
          <h3 id="sidebar-group-anytype" className="m-0 px-4 type-ui text-small text-ink-secondary">
            Anytype
          </h3>
          <SourceTree
            spaces={spaces}
            sources={sources}
            hidden={hidden}
            collapsedSpaces={collapsedSpaces}
            onSetShown={onSetShown}
            onToggleSpaceCollapsed={onToggleSpaceCollapsed}
          />
        </section>
        {feeds.length > 0 ? (
          <section aria-labelledby="sidebar-group-feeds" className="flex shrink-0 flex-col gap-4">
            <h3 id="sidebar-group-feeds" className="m-0 px-4 type-ui text-small text-ink-secondary">
              {t('calendar.sidebar.subscriptions')}
            </h3>
            <FeedList feeds={feeds} hidden={hidden} onSetShown={onSetShown} />
          </section>
        ) : null}
      </div>
    </aside>
  )
}
