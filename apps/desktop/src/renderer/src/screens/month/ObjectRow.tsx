import type { CategoryHue } from '@renderer/types'
import { catBg, Tag } from '@renderer/components/ui'

export interface ObjectRowProps {
  title: string
  category: CategoryHue
  time?: string
  typeLabel?: string
  /** Names the date relation that put this object on the grid. */
  relation?: string
  done?: boolean
  selected?: boolean
  onClick: () => void
}

/** Agenda row for one dated object. */
export function ObjectRow({
  title,
  category,
  time,
  typeLabel,
  relation,
  done = false,
  selected = false,
  onClick
}: ObjectRowProps): React.JSX.Element {
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
          'w-52 shrink-0 font-mono text-tiny tabular-nums',
          time ? 'text-ink-secondary' : 'text-ink-tertiary'
        ].join(' ')}
      >
        {time ?? 'all-day'}
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
      {relation ? (
        <span className="whitespace-nowrap type-caption text-tiny text-ink-tertiary">
          {relation}
        </span>
      ) : null}
      {typeLabel ? <Tag category={category}>{typeLabel}</Tag> : null}
    </button>
  )
}
