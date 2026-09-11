import type { AuthFailureKind } from '@renderer/types'
import { Button } from '@renderer/components/ui'
import { AuthHead } from '@renderer/screens/auth/AuthShell'
import { DigitBoxes } from '@renderer/screens/auth/DigitBoxes'

export interface AuthErrorProps {
  failure: AuthFailureKind
  code?: string
  onBack: () => void
  onRetry: () => void
}

const COPY: Record<AuthFailureKind, { title: string; body: string; detail: string; retry: string }> = {
  'invalid-code': {
    title: 'That code did not work',
    body: 'The code expired or was mistyped. Codes last 60 seconds — request a new one and Anytype will show a fresh code.',
    detail: 'Invalid or expired code (HTTP 400)',
    retry: 'Request a new code'
  },
  expired: {
    title: 'That code expired',
    body: 'Codes last 60 seconds. Request a new one and Anytype will show a fresh code.',
    detail: 'Submitted after the code expired',
    retry: 'Request a new code'
  },
  unreachable: {
    title: 'Could not reach Anytype',
    body: 'Make sure the Anytype desktop app is open on this computer, then try again.',
    detail: 'The local Anytype app did not respond',
    retry: 'Try again'
  }
}

export function AuthError({ failure, code, onBack, onRetry }: AuthErrorProps): React.JSX.Element {
  const copy = COPY[failure]
  return (
    <>
      <AuthHead icon="circle-alert" tone="danger" title={copy.title} body={copy.body} />
      {code ? <DigitBoxes value={code} invalid /> : null}
      <p className="mt-10 mb-20 type-caption text-tiny text-ink-danger" role="alert">
        {copy.detail}
      </p>
      <div className="flex gap-8">
        <Button variant="secondary" size="lg" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" size="lg" fullWidth iconLeft="refresh-cw" onClick={onRetry}>
          {copy.retry}
        </Button>
      </div>
    </>
  )
}
