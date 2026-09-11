import type { ReactNode } from 'react'
import type { IconName } from '@renderer/types'
import { Icon, type IconSize } from './Icon'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'quiet'
export type ButtonSize = 'sm' | 'md' | 'lg'

/* One primary per view; secondary is the workhorse. Hover darkens one step on filled
 * variants and lays a 4% ink wash on the flat ones. */
const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-surface-accent text-ink-inverse border-transparent shadow-1 hover:not-disabled:bg-surface-accent-hover',
  secondary:
    'bg-surface-card text-ink-body border-line-default shadow-1 hover:not-disabled:bg-stone-050',
  danger: 'bg-clay-500 text-ink-inverse border-transparent shadow-1 hover:not-disabled:bg-clay-600',
  ghost: 'bg-transparent text-ink-body border-transparent hover:not-disabled:bg-surface-hover',
  quiet:
    'bg-transparent text-ink-accent border-transparent hover:not-disabled:bg-surface-accent-soft'
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-control-sm px-10 text-tiny',
  md: 'h-control-md px-12 text-small',
  lg: 'h-control-lg px-16 text-base'
}

const glyphSize: Record<ButtonSize, IconSize> = { sm: 12, md: 14, lg: 16 }

export interface ButtonProps {
  children?: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  iconLeft?: IconName
  iconRight?: IconName
  disabled?: boolean
  loading?: boolean
  fullWidth?: boolean
  type?: 'button' | 'submit' | 'reset'
  className?: string
  onClick?: () => void
}

export function Button({
  children,
  variant = 'secondary',
  size = 'md',
  iconLeft,
  iconRight,
  disabled = false,
  loading = false,
  fullWidth = false,
  type = 'button',
  className,
  onClick
}: ButtonProps): React.JSX.Element {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={[
        'inline-flex items-center justify-center gap-6 rounded-control border type-ui',
        'tracking-body transition duration-fast ease-standard',
        'active:not-disabled:scale-press disabled:cursor-not-allowed disabled:opacity-45',
        sizeClass[size],
        variantClass[variant],
        fullWidth ? 'flex w-full' : '',
        className ?? ''
      ].join(' ')}
    >
      {loading ? (
        <Icon name="loader-circle" size={glyphSize[size]} className="animate-spinner" />
      ) : iconLeft ? (
        <Icon name={iconLeft} size={glyphSize[size]} />
      ) : null}
      {children ? <span className="whitespace-nowrap">{children}</span> : null}
      {iconRight ? <Icon name={iconRight} size={glyphSize[size]} /> : null}
    </button>
  )
}
