import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTimeFormatValue } from '@renderer/hooks/TimeFormatContext'
import { formatTime, parseTime } from '@renderer/lib/calendar'

export interface TimeFieldProps {
  /** `HH:MM`. */
  value: string
  label: string
  /**
   * Only for a time other than `value`, as `HH:MM`. The field shows `value` again either way,
   * so a time the caller refuses goes back as one it cannot read does.
   */
  onCommit: (time: string) => void
}

/**
 * A time typed in, drawn in the user's time format. It is read when it loses focus or on
 * Enter; Escape, or anything that is not a time, puts back the saved one.
 */
export function TimeField({ value, label, onCommit }: TimeFieldProps): React.JSX.Element {
  const { i18n } = useTranslation()
  const format = useTimeFormatValue()
  const shown = formatTime(value, format, i18n.language)
  /** Null while it is not being typed in. */
  const [draft, setDraft] = useState<string | null>(null)
  const cancelled = useRef(false)

  const commit = (): void => {
    const typed = draft
    setDraft(null)
    if (cancelled.current || typed === null) {
      cancelled.current = false
      return
    }
    const time = parseTime(typed)
    if (time !== null && time !== value) onCommit(time)
  }

  return (
    <input
      type="text"
      inputMode="text"
      aria-label={label}
      size={8}
      value={draft ?? shown}
      onFocus={(event) => {
        setDraft(shown)
        event.currentTarget.select()
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        else if (event.key === 'Escape') {
          event.stopPropagation()
          cancelled.current = true
          event.currentTarget.blur()
        }
      }}
      className={[
        'w-auto rounded-4 border border-line-subtle bg-transparent px-6 py-2 outline-none',
        'type-numeral text-small text-ink-body',
        'transition duration-fast ease-standard hover:bg-surface-hover focus:border-line-accent focus:shadow-focus'
      ].join(' ')}
    />
  )
}
