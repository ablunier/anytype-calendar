import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui'
import { AuthHead } from '@renderer/screens/auth/AuthShell'
import { DigitBoxes } from '@renderer/screens/auth/DigitBoxes'

export interface AuthVerifyingProps {
  code: string
  onCancel: () => void
}

export function AuthVerifying({ code, onCancel }: AuthVerifyingProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <>
      <AuthHead
        icon="loader-circle"
        title={t('auth.verifying.title')}
        body={t('auth.verifying.body')}
      />
      <DigitBoxes value={code} muted />
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
