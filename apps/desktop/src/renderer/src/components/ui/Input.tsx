import { useId } from 'react'
import type { IconName } from '../../types'
import { Icon } from './Icon'

export type FieldSize = 'sm' | 'md' | 'lg'

export const fieldHeight: Record<FieldSize, string> = {
  sm: 'h-control-sm',
  md: 'h-control-md',
  lg: 'h-control-lg'
}

export interface InputProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  hint?: string
  error?: string
  icon?: IconName
  type?: 'text' | 'password' | 'email'
  size?: FieldSize
  disabled?: boolean
  /** Render the value in the mono face — for keys and identifiers. */
  mono?: boolean
}

/** Single-line text field with an optional leading icon and inline error. */
export function Input({
  value,
  onChange,
  label,
  placeholder,
  hint,
  error,
  icon,
  type = 'text',
  size = 'md',
  disabled = false,
  mono = false
}: InputProps): React.JSX.Element {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className="flex w-full flex-col gap-6">
      {label ? (
        <label htmlFor={id} className="type-ui text-small text-ink-secondary">
          {label}
        </label>
      ) : null}
      <div
        className={[
          'flex items-center gap-6 rounded-control border px-10',
          'transition duration-fast ease-standard',
          'focus-within:shadow-focus',
          fieldHeight[size],
          disabled ? 'bg-surface-sunken' : 'bg-surface-card',
          error ? 'border-clay-500 focus-within:shadow-none' : 'border-line-default focus-within:border-line-accent'
        ].join(' ')}
      >
        {icon ? <Icon name={icon} size={14} className="text-ink-tertiary" /> : null}
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className={[
            'min-w-0 flex-1 border-0 bg-transparent text-small text-ink-body outline-none',
            mono ? 'type-numeral' : 'type-body'
          ].join(' ')}
        />
      </div>
      {error ? (
        <span id={`${id}-error`} className="flex items-center gap-4 type-caption text-tiny text-ink-danger">
          <Icon name="circle-alert" size={12} />
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="type-caption text-tiny text-ink-tertiary">
          {hint}
        </span>
      ) : null}
    </div>
  )
}
