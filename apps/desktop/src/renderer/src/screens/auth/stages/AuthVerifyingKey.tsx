import { Button } from '@renderer/components/ui'
import { AuthHead } from '@renderer/screens/auth/AuthShell'

export interface AuthVerifyingKeyProps {
  onCancel: () => void
}

export function AuthVerifyingKey({ onCancel }: AuthVerifyingKeyProps): React.JSX.Element {
  return (
    <>
      <AuthHead
        icon="loader-circle"
        title="Verifying key"
        body="Checking this key against your local Anytype app."
      />
      <div className="my-16 mb-20 flex items-center gap-8" role="status">
        <span className="animate-spinner size-icon-14 rounded-pill border-2 border-moss-100 border-t-moss-500" />
        <span className="type-ui text-small text-ink-secondary">Waiting for Anytype…</span>
      </div>
      <Button variant="secondary" size="lg" fullWidth onClick={onCancel}>
        Cancel
      </Button>
    </>
  )
}
