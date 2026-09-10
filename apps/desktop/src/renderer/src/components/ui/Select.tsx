import { useId } from 'react'
import { Icon } from './Icon'
import { fieldHeight, type FieldSize } from './Input'

export interface SelectProps {
  options: string[]
  value: string
  onChange: (value: string) => void
  label?: string
  /** Names the control when there is no visible label. */
  ariaLabel?: string
  size?: FieldSize
  disabled?: boolean
  className?: string
}

/** Native <select> under the system's control skin, so keyboard and OS behaviour hold. */
export function Select({
  options,
  value,
  onChange,
  label,
  ariaLabel,
  size = 'md',
  disabled = false,
  className
}: SelectProps): React.JSX.Element {
  const id = useId()
  return (
    /* No w-full here: a grid or flex parent already stretches the control, and forcing a
       width would collide with the explicit one the settings rows pass in. */
    <div className={['flex flex-col gap-6', className ?? ''].join(' ')}>
      {label ? (
        <label htmlFor={id} className="type-ui text-small text-ink-secondary">
          {label}
        </label>
      ) : null}
      <div
        className={[
          'relative flex items-center rounded-control border border-line-default',
          'transition duration-fast ease-standard',
          'focus-within:border-line-accent focus-within:shadow-focus',
          fieldHeight[size],
          disabled ? 'bg-surface-sunken' : 'bg-surface-card'
        ].join(' ')}
      >
        <select
          id={id}
          value={value}
          disabled={disabled}
          aria-label={label ? undefined : ariaLabel}
          onChange={(e) => onChange(e.target.value)}
          className={[
            'h-full min-w-0 flex-1 appearance-none border-0 bg-transparent pl-10 pr-28 outline-none',
            'type-ui text-small text-ink-body',
            disabled ? 'cursor-not-allowed' : 'cursor-pointer'
          ].join(' ')}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <Icon
          name="chevron-down"
          size={14}
          className="pointer-events-none absolute right-8 text-ink-tertiary"
        />
      </div>
    </div>
  )
}
