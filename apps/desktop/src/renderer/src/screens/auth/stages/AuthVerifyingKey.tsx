import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui'
import { AuthHead } from '@renderer/screens/auth/AuthShell'

export interface AuthVerifyingKeyProps {
  onCancel: () => void
}

export function AuthVerifyingKey({ onCancel }: AuthVerifyingKeyProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <>
      <AuthHead
        icon="loader-circle"
        title={t('auth.verifyingKey.title')}
        body={t('auth.verifyingKey.body')}
      />
      <div className="my-16 mb-20 flex items-center gap-8" role="status">
        <span className="animate-spinner size-icon-14 rounded-pill border-2 border-moss-100 border-t-moss-500" />
        <span className="type-ui text-small text-ink-secondary">{t('auth.waitingForAnytype')}</span>
      </div>
      <Button variant="secondary" size="lg" fullWidth onClick={onCancel}>
        {t('common.cancel')}
      </Button>
    </>
  )
}
