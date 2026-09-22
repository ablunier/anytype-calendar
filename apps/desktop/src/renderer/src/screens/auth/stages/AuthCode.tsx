import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui'
import { useSecondsUntil } from '@renderer/hooks/useSecondsUntil'
import { AuthHead } from '@renderer/screens/auth/AuthShell'
import { DigitBoxes } from '@renderer/screens/auth/DigitBoxes'

export interface AuthCodeProps {
  challengeId: string
  /** Epoch milliseconds. */
  expiresAt: number
  onCancel: () => void
  onVerify: (code: string) => void
}

function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * The design mocks this with a window keydown listener and decorative boxes. Here a real
 * (visually hidden) text input owns the value, so the field is focusable, labelled, and
 * works with paste, IME and assistive tech; DigitBoxes just draws it.
 */
export function AuthCode({
  challengeId,
  expiresAt,
  onCancel,
  onVerify
}: AuthCodeProps): React.JSX.Element {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const secondsLeft = useSecondsUntil(expiresAt)
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <AuthHead icon="shield-check" title={t('auth.code.title')} body={t('auth.code.body')} />

      <label htmlFor={inputId} className="sr-only">
        {t('auth.code.srLabel')}
      </label>
      <input
        id={inputId}
        ref={inputRef}
        value={code}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={4}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, '').slice(0, 4)
          setCode(next)
          setActiveIndex(Math.min(event.target.selectionStart ?? next.length, next.length))
        }}
        onSelect={(event) => {
          const input = event.currentTarget
          setActiveIndex(input.selectionStart ?? input.value.length)
        }}
        className="sr-only"
      />
      <DigitBoxes
        value={code}
        activeIndex={activeIndex}
        onDigitClick={(index) => {
          const input = inputRef.current
          if (!input) return
          const target = Math.min(index, code.length)
          input.focus()
          input.setSelectionRange(target, target < code.length ? target + 1 : target)
          setActiveIndex(target)
        }}
      />

      <div className="my-12 mb-20 flex items-center justify-between">
        <div className="flex items-center gap-6 type-caption text-tiny text-ink-tertiary">
          <span>{t('auth.code.challenge')}</span>
          <span className="type-numeral text-tiny text-ink-secondary">{challengeId}</span>
        </div>
        <span className="type-numeral text-tiny text-ink-tertiary">
          {secondsLeft > 0
            ? t('auth.code.expiresIn', { time: formatCountdown(secondsLeft) })
            : t('auth.code.expired')}
        </span>
      </div>

      <div className="flex gap-8">
        <Button variant="secondary" size="lg" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={code.length < 4}
          onClick={() => onVerify(code)}
        >
          {t('auth.code.verify')}
        </Button>
      </div>
    </>
  )
}
