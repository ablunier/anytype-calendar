import { useTranslation } from 'react-i18next'
import type { CategoryHue, ObjectType, Space } from '@renderer/types'
import { SpaceMonogram } from '@renderer/components/app/SpaceMonogram'
import { catBg, catText, Icon } from '@renderer/components/ui'
import { queriesInSpace, typesInSpace } from '@renderer/lib/calendar'
import { visibilityOf, type SourceVisibility } from '@renderer/lib/visibility'

export interface SourceTreeProps {
  /** In the order Settings lists them. A space none of whose sources are chosen is left out. */
  spaces: Space[]
  /** The chosen types and queries of those spaces. */
  sources: ObjectType[]
  hidden: ReadonlySet<string>
  /** Spaces whose types and queries are folded away; their toggle still hides them all. */
  collapsedSpaces: ReadonlySet<string>
  onSetShown: (keys: string[], shown: boolean) => void
  onToggleSpaceCollapsed: (spaceKey: string) => void
}

/**
 * The spaces the calendar holds and, under each, its types and then its queries, every one
 * with a toggle for whether its objects are drawn. Hiding is only that: it never changes what
 * is read, which Settings decides.
 */
export function SourceTree({
  spaces,
  sources,
  hidden,
  collapsedSpaces,
  onSetShown,
  onToggleSpaceCollapsed
}: SourceTreeProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <ul aria-label={t('calendar.sidebar.sources')} className="m-0 flex list-none flex-col gap-8 p-0">
      {spaces.map((space) => {
        const children = [...typesInSpace(sources, space.key), ...queriesInSpace(sources, space.key)]
        if (children.length === 0) return null
        const keys = children.map(({ key }) => key)
        const state = visibilityOf(keys, hidden)
        const folded = collapsedSpaces.has(space.key)
        return (
          <li key={space.key} className="flex flex-col">
            <div className="flex items-center gap-2">
              <ToggleRow
                state={state}
                name={space.name}
                marker={<SpaceMonogram space={space} />}
                onToggle={() => onSetShown(keys, state === 'hidden')}
                strong
              />
              <button
                type="button"
                aria-expanded={!folded}
                aria-label={t(folded ? 'calendar.sidebar.expandSpace' : 'calendar.sidebar.collapseSpace', {
                  name: space.name
                })}
                onClick={() => onToggleSpaceCollapsed(space.key)}
                className="flex size-20 shrink-0 items-center justify-center rounded-4 border-0 bg-transparent p-0 text-ink-tertiary hover:bg-surface-hover"
              >
                <Icon name={folded ? 'chevron-right' : 'chevron-down'} size={14} />
              </button>
            </div>
            {folded ? null : (
              <ul className="m-0 flex list-none flex-col p-0 pl-16">
                {children.map((source) => {
                  const sourceState = visibilityOf([source.key], hidden)
                  return (
                    <li key={source.key}>
                      <ToggleRow
                        state={sourceState}
                        name={source.label}
                        marker={<Icon name={source.icon} size={16} className={`shrink-0 ${catText[source.category]}`} />}
                        hue={source.category}
                        onToggle={() => onSetShown([source.key], sourceState === 'hidden')}
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

interface ToggleRowProps {
  state: SourceVisibility
  name: string
  marker: React.ReactNode
  /** Fills the box of a type's row with its hue. */
  hue?: CategoryHue
  onToggle: () => void
  strong?: boolean
}

/** One button for the whole row, so the target is as wide as the sidebar. */
function ToggleRow({ state, name, marker, hue, onToggle, strong = false }: ToggleRowProps): React.JSX.Element {
  const { t } = useTranslation()
  const on = state !== 'hidden'
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === 'mixed' ? 'mixed' : state === 'shown'}
      aria-label={t(state === 'hidden' ? 'calendar.sidebar.show' : 'calendar.sidebar.hide', { name })}
      onClick={onToggle}
      className="group flex w-full items-center gap-8 rounded-6 border-0 bg-transparent px-4 py-2 text-left hover:bg-surface-hover"
    >
      <span
        aria-hidden
        className={[
          'flex size-16 shrink-0 items-center justify-center rounded-4 border',
          'group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-focus-ring',
          on ? `border-transparent ${hue ? catBg[hue] : 'bg-surface-accent'}` : 'border-line-strong bg-surface-card'
        ].join(' ')}
      >
        {on ? <Icon name={state === 'mixed' ? 'minus' : 'check'} size={11} className="text-stone-000" /> : null}
      </span>
      {marker}
      <span
        className={[
          'min-w-0 flex-1 truncate',
          strong ? 'type-ui text-small text-ink-primary' : 'type-caption text-small text-ink-secondary',
          on ? '' : 'opacity-60'
        ].join(' ')}
      >
        {name}
      </span>
    </button>
  )
}
