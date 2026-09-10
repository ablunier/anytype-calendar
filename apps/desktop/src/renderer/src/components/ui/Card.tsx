import type { ReactNode } from 'react'

export type CardPadding = 'dense' | 'default' | 'roomy'

/* White surface, hairline border, 10px radius, shadow-1. 16px padding, 12 dense,
 * 20 roomy. Never a coloured left border, never a gradient, never nested twice. */
const paddingClass: Record<CardPadding, string> = {
  dense: 'p-12',
  default: 'p-16',
  roomy: 'p-24'
}

export interface CardProps {
  children: ReactNode
  padding?: CardPadding
  /** 0 removes the shadow; 2 is the hover/popover step. */
  elevation?: 0 | 1 | 2
  className?: string
}

export function Card({
  children,
  padding = 'default',
  elevation = 1,
  className
}: CardProps): React.JSX.Element {
  const shadow = elevation === 0 ? 'shadow-none' : elevation === 2 ? 'shadow-2' : 'shadow-1'
  return (
    <div
      className={[
        'rounded-card border border-line-subtle bg-surface-card',
        paddingClass[padding],
        shadow,
        className ?? ''
      ].join(' ')}
    >
      {children}
    </div>
  )
}
