import { useId, useRef, useState } from 'react'
import { Button } from '../../../components/ui'
import { AuthHead } from '../AuthShell'
import { DigitBoxes } from '../DigitBoxes'

export interface AuthCodeProps {
  onCancel: () => void
  onVerify: () => void
}

const CHALLENGE_ID = 'ch_8f2a41'
const EXPIRES_IN = '0:42'

/**
 * (b) Code entry.
 *
 * The design mocks this with a window keydown listener and decorative boxes. Here a real
 * (visually hidden) text input owns the value, so the field is focusable, labelled, and
 * works with paste, IME and assistive tech; DigitBoxes just draws it.
 */
export function AuthCode({ onCancel, onVerify }: AuthCodeProps): React.JSX.Element {
  const [code, setCode] = useState('27')
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
        maxLength={4}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 4))}
        className="sr-only"
      />
      {/* Clicking the boxes focuses the real field behind them. */}
      <div onClick={() => inputRef.current?.focus()}>
        <DigitBoxes value={code} />
      </div>

      <div className="my-12 mb-20 flex items-center justify-between">
        <div className="flex items-center gap-6 type-caption text-tiny text-ink-tertiary">
          <span>Challenge</span>
          <span className="type-numeral text-tiny text-ink-secondary">{CHALLENGE_ID}</span>
        </div>
        <span className="type-numeral text-tiny text-ink-tertiary">expires in {EXPIRES_IN}</span>
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
          onClick={onVerify}
        >
          Verify code
        </Button>
      </div>
    </>
  )
}
