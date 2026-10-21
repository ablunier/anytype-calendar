import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { longDate, shortDate } from '@renderer/lib/calendar'
import { MiniMonth } from './MiniMonth'

/** The picker's width, and the gap it keeps from the window's edge. */
const PICKER_WIDTH = 240
const EDGE = 8

export interface DateFieldProps {
  /** `YYYY-MM-DD`. */
  value: string
  /** Names the date, e.g. the property it is ("Due date"). */
  label: string
  /** `YYYY-MM-DD`; the days before it cannot be picked. */
  min?: string
  /** `YYYY-MM-DD`. */
  today: string
  weekStart: number
  showWeekNumbers: boolean
  /** Only for a day other than `value`. */
  onChange: (date: string) => void
}

/**
 * A date that opens a month to pick another from. Not `<input type="date">`: Chromium draws
 * that in its own locale, which has no Galician, and ignores the user's first day of the week.
 *
 * The month is placed against the window, not the panel it sits in, since the panel scrolls
 * and is too narrow for it beside a To date.
 */
export function DateField({
  value,
  label,
  min,
  today,
  weekStart,
  showWeekNumbers,
  onChange
}: DateFieldProps): React.JSX.Element {
  const { i18n } = useTranslation()
  const [place, setPlace] = useState<CSSProperties | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const open = place !== null

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      if (!root.current?.contains(event.target as Node)) setPlace(null)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setPlace(null)
      button.current?.focus()
    }
    const close = (): void => setPlace(null)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    // Placed once, it would part from the date as the panel scrolled.
    document.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const toggle = (): void => {
    const rect = button.current?.getBoundingClientRect()
    if (open || !rect) {
      setPlace(null)
      return
    }
    setPlace({
      top: rect.bottom + 4,
      left: Math.max(EDGE, Math.min(rect.left, window.innerWidth - PICKER_WIDTH - EDGE))
    })
  }

  const pick = (date: string): void => {
    setPlace(null)
    button.current?.focus()
    if (date !== value) onChange(date)
  }

  return (
    <div ref={root} className="flex">
      <button
        ref={button}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${longDate(value, i18n.language)}`}
        onClick={toggle}
        className={[
          'rounded-4 border border-line-subtle px-6 py-2 text-left type-numeral text-small text-ink-body',
          'transition duration-fast ease-standard hover:bg-surface-hover focus-visible:shadow-focus',
          open ? 'bg-surface-hover' : 'bg-transparent'
        ].join(' ')}
      >
        {shortDate(value, i18n.language)}
      </button>
      {place ? (
        <div
          role="dialog"
          aria-label={label}
          style={place}
          className="fixed z-40 w-240 rounded-8 border border-line-subtle bg-surface-card p-12 shadow-3"
        >
          <MiniMonth
            label={label}
            opensOn={value}
            marked={{ first: value, last: value }}
            today={today}
            weekStart={weekStart}
            showWeekNumbers={showWeekNumbers}
            {...(min === undefined ? {} : { min })}
            onSelectDate={pick}
          />
        </div>
      ) : null}
    </div>
  )
}
