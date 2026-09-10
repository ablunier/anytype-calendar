import type { Space } from '../../../types'
import { SpaceDot } from '../../../components/app/SpaceDot'
import { Button, SyncStatus } from '../../../components/ui'
import { AuthHead } from '../AuthShell'

export interface AuthSuccessProps {
  spaces: Space[]
  onContinue: () => void
}

/** (e) Connected — the key covers every space on the account. */
export function AuthSuccess({ spaces, onContinue }: AuthSuccessProps): React.JSX.Element {
  const totalObjects = spaces.reduce((total, space) => total + space.objects, 0)
  return (
    <>
      <AuthHead
        icon="calendar-check"
        title="Connected to your account"
        body="The key is saved on this computer and covers every space on the account. Pick which ones to show next."
      />
      <ul className="mb-16 flex list-none flex-col gap-6 rounded-8 bg-surface-sunken p-12">
        {spaces.map((space) => (
          <li key={space.key} className="flex items-center gap-8">
            <SpaceDot space={space} />
            <span className="flex-1 type-ui text-small text-ink-body">{space.name}</span>
            <span className="type-numeral text-tiny text-ink-tertiary">{space.objects} dated</span>
          </li>
        ))}
      </ul>
      <div className="mb-20 flex items-center justify-between">
        <SyncStatus state="synced" detail="just now" compact />
        <span className="type-numeral text-tiny text-ink-secondary">
          {spaces.length} spaces · {totalObjects} objects
        </span>
      </div>
      <Button variant="primary" size="lg" fullWidth iconRight="chevron-right" onClick={onContinue}>
        Choose spaces and types
      </Button>
    </>
  )
}
