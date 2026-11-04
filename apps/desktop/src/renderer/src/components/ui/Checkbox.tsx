import type { CategoryHue } from '@renderer/types'
import { useId } from 'react'
import { catBg } from './category'
import { Icon } from './Icon'

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** When omitted, pass `ariaLabel` so the control is still named. */
  label?: string
  /** Sits between the box and the label text, inside the label so a click on it toggles too. */
  leading?: React.ReactNode
  /** Replaces the label text's default tone and size. */
  labelClassName?: string
  description?: string
  ariaLabel?: string
  /** Fills the box with a category hue instead of the accent. */
  swatch?: CategoryHue
  disabled?: boolean
}

/**
 * The design system's screens wrap a decorative box in a clickable <div> with
 * role="checkbox"; a visually hidden native input instead makes it focusable, toggleable
 * with Space, and announced with its state for free.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  leading,
  labelClassName = 'text-small text-ink-body',
  description,
  ariaLabel,
  swatch,
  disabled = false,
}: CheckboxProps): React.JSX.Element {
  const id = useId()
  const fill = swatch ? catBg[swatch] : 'bg-surface-accent'
  return (
    /* `relative` is load-bearing: the input below is `sr-only`, which is `position:
     * absolute`. Without a positioned ancestor its containing block is the initial one,
     * so it escapes any scroll container it sits in and stretches the document's own
     * scrollable area down to its static position — a second, page-level scrollbar
     * beside the intended one on checkbox-dense screens like Settings. */
    <div
      className={[
        'relative flex min-w-0 gap-8',
        description ? 'items-start' : 'items-center',
        disabled ? 'opacity-45' : '',
      ].join(' ')}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label ? undefined : ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        aria-hidden
        className={[
          'flex size-16 shrink-0 items-center justify-center rounded-4 border',
          'transition duration-fast ease-standard',
          description ? 'mt-2' : '',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
          checked ? `border-transparent ${fill}` : 'border-line-strong bg-surface-card',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
          'peer-focus-visible:outline-focus-ring',
        ].join(' ')}
      >
        {checked ? <Icon name="check" size={11} className="text-stone-000" /> : null}
      </label>
      {label ? (
        <label
          htmlFor={id}
          className={['flex min-w-0 items-center gap-10', disabled ? 'cursor-not-allowed' : 'cursor-pointer'].join(' ')}
        >
          {leading}
          <span className="flex min-w-0 flex-col gap-2">
            <span className={['truncate type-ui', labelClassName].join(' ')}>{label}</span>
            {description ? <span className="type-caption text-tiny text-ink-tertiary">{description}</span> : null}
          </span>
        </label>
      ) : null}
    </div>
  )
}
