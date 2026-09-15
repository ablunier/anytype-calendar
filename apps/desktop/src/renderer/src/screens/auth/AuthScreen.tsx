import type { AuthStage, AuthView, Space, SyncView } from '@renderer/types'
import { Button, Card } from '@renderer/components/ui'
import { AuthShell } from './AuthShell'
import { AuthApiKey } from './stages/AuthApiKey'
import { AuthCode } from './stages/AuthCode'
import { AuthError } from './stages/AuthError'
import { AuthStart } from './stages/AuthStart'
import { AuthSuccess } from './stages/AuthSuccess'
import { AuthVerifying } from './stages/AuthVerifying'
import { AuthVerifyingKey } from './stages/AuthVerifyingKey'

export interface AuthScreenProps {
  view: AuthView
  spaces: Space[]
  sync: SyncView
  onStart: () => void
  onEnterKey: () => void
  onSubmitCode: (code: string) => void
  onSubmitApiKey: (apiKey: string) => void
  onStepBack: () => void
  onRetrySync: () => void
  onContinue: () => void
}

export function AuthScreen({
  view,
  spaces,
  sync,
  onStart,
  onEnterKey,
  onSubmitCode,
  onSubmitApiKey,
  onStepBack,
  onRetrySync,
  onContinue
}: AuthScreenProps): React.JSX.Element {
  return (
    <AuthShell>
      <Card padding="roomy">
        {view.stage === 'start' ? <AuthStart onStart={onStart} onEnterKey={onEnterKey} /> : null}
        {view.stage === 'code' ? (
          /* Keyed by challenge, so requesting a new code also clears the field. */
          <AuthCode
            key={view.challengeId}
            challengeId={view.challengeId}
            expiresAt={view.expiresAt}
            onCancel={onStepBack}
            onVerify={onSubmitCode}
          />
        ) : null}
        {view.stage === 'verifying' ? <AuthVerifying code={view.code} onCancel={onStepBack} /> : null}
        {view.stage === 'entering-key' ? (
          <AuthApiKey onCancel={onStepBack} onConnect={onSubmitApiKey} />
        ) : null}
        {view.stage === 'verifying-key' ? <AuthVerifyingKey onCancel={onStepBack} /> : null}
        {view.stage === 'error' ? (
          <AuthError
            failure={view.failure}
            origin={view.origin}
            code={view.code}
            onBack={onStepBack}
            onRetry={onStart}
          />
        ) : null}
        {view.stage === 'success' ? (
          <AuthSuccess spaces={spaces} sync={sync} onRetry={onRetrySync} onContinue={onContinue} />
        ) : null}
      </Card>
      <AuthFooter stage={view.stage} onRequestNew={onStart} />
    </AuthShell>
  )
}

interface AuthFooterProps {
  stage: AuthStage
  onRequestNew: () => void
}

function AuthFooter({ stage, onRequestNew }: AuthFooterProps): React.JSX.Element {
  if (stage === 'code') {
    return (
      <p className="mt-16 text-center type-caption text-tiny text-ink-tertiary">
        No code showing?{' '}
        <Button variant="quiet" size="sm" onClick={onRequestNew}>
          Request a new one
        </Button>
      </p>
    )
  }
  return (
    <p className="mt-16 text-center type-caption text-tiny text-ink-tertiary">
      Keys are stored on this computer only. No account, no server copy.
    </p>
  )
}
