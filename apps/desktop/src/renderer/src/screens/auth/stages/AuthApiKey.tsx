import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Input } from '@renderer/components/ui'
import { AuthHead } from '@renderer/screens/auth/AuthShell'

export interface AuthApiKeyProps {
  onCancel: () => void
  onConnect: (apiKey: string) => void
}

export function AuthApiKey({ onCancel, onConnect }: AuthApiKeyProps): React.JSX.Element {
  const { t } = useTranslation()
  const [apiKey, setApiKey] = useState('')

  return (
    <>
      <AuthHead icon="key-round" title={t('auth.apiKey.title')} body={t('auth.apiKey.body')} />
      <Input value={apiKey} onChange={setApiKey} label={t('auth.apiKey.label')} mono />
      <div className="mt-20 flex gap-8">
        <Button variant="secondary" size="lg" onClick={onCancel}>
          {t('common.back')}
        </Button>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={apiKey.trim().length === 0}
          onClick={() => onConnect(apiKey.trim())}
        >
          {t('auth.apiKey.connect')}
        </Button>
      </div>
    </>
  )
}
