import type { AuthStage } from '@renderer/types'
import { Button } from '@renderer/components/ui'
import { AuthHead } from '@renderer/screens/auth/AuthShell'
import { DigitBoxes } from '@renderer/screens/auth/DigitBoxes'

export interface AuthVerifyingProps {
  onCancel: () => void
  /** Both outcomes are offered explicitly — nothing is actually exchanged. */
  onSettled: (stage: AuthStage) => void
}

export function AuthVerifying({ onCancel, onSettled }: AuthVerifyingProps): React.JSX.Element {
  return (
    <>
      <AuthHead
        icon="loader-circle"
        title="Verifying code"
        body="Exchanging the code for an API key with your local Anytype app."
      />
      <DigitBoxes value="2749" muted />
      <div className="my-16 mb-20 flex items-center gap-8" role="status">
        <span className="animate-spinner size-icon-14 rounded-pill border-2 border-moss-100 border-t-moss-500" />
        <span className="type-ui text-small text-ink-secondary">Waiting for Anytype…</span>
      </div>
      <div className="flex flex-col gap-8">
        <Button variant="secondary" size="lg" fullWidth onClick={onCancel}>
          Cancel
        </Button>
        {/* No exchange happens in this pass, so both outcomes stay reachable by hand. */}
        <div className="flex gap-8">
          <Button variant="quiet" size="sm" fullWidth onClick={() => onSettled('success')}>
            Simulate success
          </Button>
          <Button variant="quiet" size="sm" fullWidth onClick={() => onSettled('error')}>
            Simulate failure
          </Button>
        </div>
      </div>
    </>
  )
}
