import type { ReactNode } from 'react'
import type { IconName } from '@renderer/types'
import { Icon } from './Icon'

export interface EmptyStateProps {
  title: string
  icon?: IconName
  description?: string
  action?: ReactNode
  compact?: boolean
}

/** Centered placeholder for a view with nothing in it. Names the next move, never "No data". */
export function EmptyState({
  title,
  icon = 'inbox',
  description,
  action,
  compact = false
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={[
        'flex flex-col items-center justify-center gap-8 text-center',
        compact ? 'p-24' : 'px-24 py-56'
      ].join(' ')}
    >
      <span
        className={[
          'mb-4 flex items-center justify-center rounded-10 bg-surface-sunken',
          compact ? 'size-control-md' : 'size-40'
        ].join(' ')}
      >
        <Icon name={icon} size={compact ? 16 : 20} className="text-ink-tertiary" />
      </span>
      <div
        className={['type-ui text-ink-primary', compact ? 'text-small' : 'text-base'].join(' ')}
      >
        {title}
      </div>
      {description ? (
        <div className="max-w-320 type-caption text-small leading-normal text-ink-secondary">
          {description}
        </div>
      ) : null}
      {action ? <div className="mt-8">{action}</div> : null}
    </div>
  )
}
