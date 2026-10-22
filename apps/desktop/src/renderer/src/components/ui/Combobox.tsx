import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { fieldHeight, type FieldSize } from './Input'

export interface ComboboxOption {
  value: string
  label: string
  /** Drawn muted after the label, to tell options of one label apart. */
  detail?: string
  /** Listed whatever is typed, like a "None", and so never counted as a match. */
  pinned?: boolean
}

export interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  /** What the list offers for what was typed, `''` being nothing: the caller does the matching. */
  optionsFor: (query: string) => ComboboxOption[]
  /** Said in the list when what was typed matches none but the pinned options. */
  noMatchText: string
  label?: string
  /** Names the control when there is no visible label. */
  ariaLabel?: string
  size?: FieldSize
  className?: string
}

/** Pixels between the field and its list. */
const LIST_GAP = 4

/**
 * A select that can be typed in to narrow its list, after the ARIA combobox pattern: focus
 * stays in the field and `aria-activedescendant` names the option ↑/↓ reach. Enter picks it;
 * Escape closes the list and keeps the earlier pick, without letting a dialog around it close;
 * Tab leaves with the pick as it was.
 *
 * The list is drawn in a portal, fixed under the field, since a dialog clips what overflows it.
 * React still bubbles its clicks through the dialog, which so does not take them for clicks on
 * its scrim.
 */
export function Combobox({
  value,
  onChange,
  optionsFor,
  noMatchText,
  label,
  ariaLabel,
  size = 'md',
  className
}: ComboboxProps): React.JSX.Element {
  const id = useId()
  const listId = `${id}-list`
  const optionId = (index: number): string => `${id}-option-${index}`
  const fieldRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [place, setPlace] = useState<{ top: number; left: number; width: number } | null>(null)

  const selected = optionsFor('').find((option) => option.value === value)
  const options = open ? optionsFor(query) : []
  const matched = options.some(({ pinned }) => !pinned)

  const show = (typed: string): void => {
    const listed = optionsFor(typed)
    const picked = listed.findIndex((option) => option.value === value)
    const firstMatch = listed.findIndex(({ pinned }) => !pinned)
    setQuery(typed)
    setOpen(true)
    // Typing moves to what it found, so Enter picks it; opening shows where the pick is.
    setActive(Math.max(typed === '' ? picked : firstMatch, 0))
  }
  const close = (): void => {
    setOpen(false)
    setQuery('')
  }
  const pick = (option: ComboboxOption): void => {
    onChange(option.value)
    close()
  }

  useLayoutEffect(() => {
    if (!open) return
    const measure = (): void => {
      const rect = fieldRef.current?.getBoundingClientRect()
      if (rect) setPlace({ top: rect.bottom + LIST_GAP, left: rect.left, width: rect.width })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' })
  })

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault()
        if (!open) {
          show('')
          return
        }
        const step = event.key === 'ArrowDown' ? 1 : -1
        setActive((index) => Math.min(Math.max(index + step, 0), options.length - 1))
        return
      }
      case 'Enter': {
        if (!open) return
        // Picks, rather than submitting the form the field is in.
        event.preventDefault()
        const option = options[active]
        if (option) pick(option)
        return
      }
      case 'Escape':
        if (!open) return
        event.preventDefault()
        event.stopPropagation()
        close()
        return
      case 'Tab':
        close()
    }
  }

  return (
    <div className={['flex flex-col gap-6', className ?? ''].join(' ')}>
      {label ? (
        <label htmlFor={id} className="type-ui text-small text-ink-secondary">
          {label}
        </label>
      ) : null}
      <div
        ref={fieldRef}
        className={[
          'relative flex items-center gap-6 rounded-control border border-line-default bg-surface-card pl-10 pr-28',
          'transition duration-fast ease-standard',
          'focus-within:border-line-accent focus-within:shadow-focus',
          fieldHeight[size]
        ].join(' ')}
      >
        <input
          id={id}
          role="combobox"
          aria-label={label ? undefined : ariaLabel}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? optionId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
          value={open ? query : (selected?.label ?? '')}
          placeholder={open ? selected?.label : undefined}
          onChange={(event) => show(event.target.value)}
          onClick={() => {
            if (!open) show('')
          }}
          onKeyDown={onKeyDown}
          onBlur={close}
          className="type-ui h-full min-w-0 flex-1 border-0 bg-transparent text-small text-ink-body outline-none"
        />
        {!open && selected?.detail ? (
          <span className="type-ui max-w-1/2 shrink-0 truncate text-small text-ink-tertiary">{selected.detail}</span>
        ) : null}
        <Icon
          name="chevron-down"
          size={14}
          className="pointer-events-none absolute right-8 text-ink-tertiary"
        />
      </div>
      {open && place
        ? createPortal(
            <ul
              id={listId}
              role="listbox"
              aria-label={label ?? ariaLabel}
              // Keeps focus in the field, which would close the list on blur before a click lands.
              onMouseDown={(event) => event.preventDefault()}
              style={{ top: place.top, left: place.left, width: place.width }}
              className={[
                'fixed z-70 flex max-h-240 flex-col overflow-y-auto rounded-control border border-line-subtle',
                'bg-surface-raised py-4 shadow-2'
              ].join(' ')}
            >
              {options.map((option, index) => (
                <li
                  key={option.value}
                  id={optionId(index)}
                  role="option"
                  aria-selected={option.value === value}
                  onMouseMove={() => setActive(index)}
                  onClick={() => pick(option)}
                  className={[
                    'type-ui flex cursor-pointer items-center gap-6 px-10 py-6 text-small text-ink-body',
                    index === active ? 'bg-surface-hover' : ''
                  ].join(' ')}
                >
                  <span className="min-w-0 truncate">
                    {option.label}
                    {option.detail ? <span className="text-ink-tertiary"> · {option.detail}</span> : null}
                  </span>
                  {option.value === value ? (
                    <Icon name="check" size={14} className="ml-auto shrink-0 text-ink-accent" />
                  ) : null}
                </li>
              ))}
              {matched ? null : (
                <li role="presentation" className="type-ui px-10 py-6 text-small text-ink-tertiary">
                  {noMatchText}
                </li>
              )}
            </ul>,
            document.body
          )
        : null}
    </div>
  )
}
