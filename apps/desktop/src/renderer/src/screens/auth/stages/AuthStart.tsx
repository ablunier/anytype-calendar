import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui'
import { AuthHead } from '@renderer/screens/auth/AuthShell'

export interface AuthStartProps {
  onStart: () => void
  onEnterKey: () => void
}

export function AuthStart({ onStart, onEnterKey }: AuthStartProps): React.JSX.Element {
  const { t } = useTranslation()
  const steps = [t('auth.start.step1'), t('auth.start.step2'), t('auth.start.step3')]

  return (
    <>
      <AuthHead icon="unplug" title={t('auth.start.title')} body={t('auth.start.body')} />
      <ol className="mb-20 flex list-none flex-col gap-8 p-0">
        {steps.map((step, index) => (
          <li key={step} className="flex items-center gap-8 type-ui text-small text-ink-body">
            <span className="w-18 type-numeral text-micro text-ink-tertiary">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
      <Button variant="primary" size="lg" fullWidth iconLeft="link" onClick={onStart}>
        {t('auth.start.startConnection')}
      </Button>
      <p className="mt-12 text-center type-caption text-tiny text-ink-tertiary">
        {t('auth.start.alreadyHaveKey')}{' '}
        <Button variant="quiet" size="sm" onClick={onEnterKey}>
          {t('auth.start.pasteItInstead')}
        </Button>
      </p>
    </>
  )
}
