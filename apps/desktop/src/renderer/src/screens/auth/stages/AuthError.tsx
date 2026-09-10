import { Button } from '../../../components/ui'
import { AuthHead } from '../AuthShell'
import { DigitBoxes } from '../DigitBoxes'

export interface AuthErrorProps {
  onBack: () => void
  onRetry: () => void
}

/** (d) The code expired or was mistyped. */
export function AuthError({ onBack, onRetry }: AuthErrorProps): React.JSX.Element {
  return (
    <>
      <AuthHead
        icon="circle-alert"
        tone="danger"
        title="That code did not work"
        body="The code expired or was mistyped. Codes last 60 seconds — request a new one and Anytype will show a fresh code."
      />
      <DigitBoxes value="2749" invalid />
      <p className="mt-10 mb-20 type-caption text-tiny text-ink-danger" role="alert">
        Invalid or expired code (HTTP 400)
      </p>
      <div className="flex gap-8">
        <Button variant="secondary" size="lg" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" size="lg" fullWidth iconLeft="refresh-cw" onClick={onRetry}>
          Request a new code
        </Button>
      </div>
    </>
  )
}
