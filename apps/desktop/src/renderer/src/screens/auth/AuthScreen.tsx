import type { AuthStage, Space } from '@renderer/types'
import { Button, Card } from '@renderer/components/ui'
import { AuthShell } from './AuthShell'
import { AuthCode } from './stages/AuthCode'
import { AuthError } from './stages/AuthError'
import { AuthStart } from './stages/AuthStart'
import { AuthSuccess } from './stages/AuthSuccess'
import { AuthVerifying } from './stages/AuthVerifying'

export interface AuthScreenProps {
  stage: AuthStage
  spaces: Space[]
  onStageChange: (stage: AuthStage) => void
  onConnected: () => void
}

/**
 * Nothing here authenticates: the buttons move `stage`, and no request is made. The real
 * flow (POST /v1/auth/challenges, then /v1/auth/api_keys) arrives behind IPC in a later
 * pass and will drive the same stage prop.
 */
export function AuthScreen({
  stage,
  spaces,
  onStageChange,
  onConnected
}: AuthScreenProps): React.JSX.Element {
  return (
    <AuthShell>
      <Card padding="roomy">
        {stage === 'start' ? <AuthStart onStart={() => onStageChange('code')} /> : null}
        {stage === 'code' ? (
          <AuthCode
            onCancel={() => onStageChange('start')}
            onVerify={() => onStageChange('verifying')}
          />
        ) : null}
        {stage === 'verifying' ? (
          <AuthVerifying
            onCancel={() => onStageChange('code')}
            onSettled={(next) => onStageChange(next)}
          />
        ) : null}
        {stage === 'error' ? (
          <AuthError onBack={() => onStageChange('code')} onRetry={() => onStageChange('code')} />
        ) : null}
        {stage === 'success' ? <AuthSuccess spaces={spaces} onContinue={onConnected} /> : null}
      </Card>
      <AuthFooter stage={stage} onRequestNew={() => onStageChange('code')} />
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
