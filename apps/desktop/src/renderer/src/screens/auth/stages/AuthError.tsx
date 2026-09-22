import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import type { AuthFailureKind } from '@renderer/types'
import { Button } from '@renderer/components/ui'
import { AuthHead } from '@renderer/screens/auth/AuthShell'
import { DigitBoxes } from '@renderer/screens/auth/DigitBoxes'

export interface AuthErrorProps {
  failure: AuthFailureKind
  /** Decides whether "back"/retry return to the code challenge or to pasting a key. */
  origin: 'code' | 'key'
  code?: string
  onBack: () => void
  onRetry: () => void
}

interface FailureCopy {
  title: string
  body: string
  detail: string
  retry: string
}

function copyFor(t: TFunction, failure: AuthFailureKind): FailureCopy {
  const table: Record<AuthFailureKind, FailureCopy> = {
    'invalid-code': {
      title: t('auth.error.invalidCode.title'),
      body: t('auth.error.invalidCode.body'),
      detail: t('auth.error.invalidCode.detail'),
      retry: t('auth.error.invalidCode.retry')
    },
    expired: {
      title: t('auth.error.expired.title'),
      body: t('auth.error.expired.body'),
      detail: t('auth.error.expired.detail'),
      retry: t('auth.error.expired.retry')
    },
    unreachable: {
      title: t('auth.error.unreachable.title'),
      body: t('auth.error.unreachable.body'),
      detail: t('auth.error.unreachable.detail'),
      retry: t('auth.error.unreachable.retry')
    },
    'invalid-key': {
      title: t('auth.error.invalidKey.title'),
      body: t('auth.error.invalidKey.body'),
      detail: t('auth.error.invalidKey.detail'),
      retry: t('auth.error.invalidKey.retry')
    }
  }
  return table[failure]
}

export function AuthError({ failure, origin, code, onBack, onRetry }: AuthErrorProps): React.JSX.Element {
  const { t } = useTranslation()
  const copy = copyFor(t, failure)
  return (
    <>
      <AuthHead icon="circle-alert" tone="danger" title={copy.title} body={copy.body} />
      {code ? <DigitBoxes value={code} invalid /> : null}
      <p className="mt-10 mb-20 type-caption text-tiny text-ink-danger" role="alert">
        {copy.detail}
      </p>
      {origin === 'key' ? (
        // Both "back" and "retry" land on the same paste-a-key form here, so one button does.
        <Button variant="primary" size="lg" fullWidth iconLeft="refresh-cw" onClick={onBack}>
          {copy.retry}
        </Button>
      ) : (
        <div className="flex gap-8">
          <Button variant="secondary" size="lg" onClick={onBack}>
            {t('common.back')}
          </Button>
          <Button variant="primary" size="lg" fullWidth iconLeft="refresh-cw" onClick={onRetry}>
            {copy.retry}
          </Button>
        </div>
      )}
    </>
  )
}
