import { useId, useRef, useState } from 'react'
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
  const [code, setCode] = useState('')
  const secondsLeft = useSecondsUntil(expiresAt)
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <AuthHead
        icon="shield-check"
        title="Enter the code from Anytype"
        body="Anytype is showing a 4-digit code on this computer. Type it here to issue a key for your account."
      />

      <label htmlFor={inputId} className="sr-only">
        4-digit code from Anytype
      </label>
      <input
        id={inputId}
        ref={inputRef}
        value={code}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={4}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
        className="sr-only"
      />
      <div onClick={() => inputRef.current?.focus()}>
        <DigitBoxes value={code} />
      </div>

      <div className="my-12 mb-20 flex items-center justify-between">
        <div className="flex items-center gap-6 type-caption text-tiny text-ink-tertiary">
          <span>Challenge</span>
          <span className="type-numeral text-tiny text-ink-secondary">{challengeId}</span>
        </div>
        <span className="type-numeral text-tiny text-ink-tertiary">
          {secondsLeft > 0 ? `expires in ${formatCountdown(secondsLeft)}` : 'expired'}
        </span>
      </div>

      <div className="flex gap-8">
        <Button variant="secondary" size="lg" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={code.length < 4}
          onClick={() => onVerify(code)}
        >
          Verify code
        </Button>
      </div>
    </>
  )
}
