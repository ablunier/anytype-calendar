import { useState } from 'react'
import { Button, Input } from '@renderer/components/ui'
import { AuthHead } from '@renderer/screens/auth/AuthShell'

export interface AuthApiKeyProps {
  onCancel: () => void
  onConnect: (apiKey: string) => void
}

export function AuthApiKey({ onCancel, onConnect }: AuthApiKeyProps): React.JSX.Element {
  const [apiKey, setApiKey] = useState('')

  return (
    <>
      <AuthHead
        icon="key-round"
        title="Paste your API key"
        body="Already issued a key for this app in Anytype's API settings? Paste it here to connect without the code step."
      />
      <Input value={apiKey} onChange={setApiKey} label="API key" mono />
      <div className="mt-20 flex gap-8">
        <Button variant="secondary" size="lg" onClick={onCancel}>
          Back
        </Button>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={apiKey.trim().length === 0}
          onClick={() => onConnect(apiKey.trim())}
        >
          Connect
        </Button>
      </div>
    </>
  )
}
