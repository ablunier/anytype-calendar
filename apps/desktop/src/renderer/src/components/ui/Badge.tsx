import type { ReactNode } from 'react'
import type { IconName } from '@renderer/types'
import { Icon } from './Icon'

export type BadgeTone = 'neutral' | 'accent' | 'warning' | 'danger' | 'info'

const toneClass: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-ink-secondary',
  accent: 'bg-surface-accent-soft text-ink-accent',
  warning: 'bg-ochre-100 text-ochre-600',
  danger: 'bg-clay-100 text-clay-600',
  info: 'bg-dusk-100 text-dusk-600'
}

export interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  icon?: IconName
  /** For counts and identifiers. */
  mono?: boolean
}

export function Badge({ children, tone = 'neutral', icon, mono = false }: BadgeProps): React.JSX.Element {
  return (
    <span
      className={[
        'inline-flex h-20 items-center gap-4 rounded-4 px-6 font-medium',
        mono ? 'type-numeral text-tiny' : 'type-caption text-tiny',
        toneClass[tone]
      ].join(' ')}
    >
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  )
}
