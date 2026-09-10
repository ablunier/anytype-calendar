import type { IconName } from '../../types'
import { Icon, type IconSize } from './Icon'

export type IconButtonSize = 'sm' | 'md' | 'lg'

const boxClass: Record<IconButtonSize, string> = {
  sm: 'size-24',
  md: 'size-28',
  lg: 'size-control-md'
}

const glyphSize: Record<IconButtonSize, IconSize> = { sm: 14, md: 16, lg: 18 }

export interface IconButtonProps {
  icon: IconName
  /** Required: this control has no visible text, so it needs an accessible name. */
  label: string
  size?: IconButtonSize
  variant?: 'ghost' | 'outline'
  active?: boolean
  disabled?: boolean
  className?: string
  onClick?: () => void
}

/** Square icon-only control for toolbars, rails and row affordances. */
export function IconButton({
  icon,
  label,
  size = 'md',
  variant = 'ghost',
  active = false,
  disabled = false,
  className,
  onClick
}: IconButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex items-center justify-center rounded-6 border p-0 transition duration-fast ease-standard',
        'disabled:cursor-not-allowed disabled:opacity-40',
        boxClass[size],
        variant === 'outline' ? 'border-line-default bg-surface-card' : 'border-transparent',
        active ? 'bg-surface-active text-ink-primary' : 'text-ink-secondary',
        active ? '' : 'hover:not-disabled:bg-surface-hover',
        className ?? ''
      ].join(' ')}
    >
      <Icon name={icon} size={glyphSize[size]} />
    </button>
  )
}
