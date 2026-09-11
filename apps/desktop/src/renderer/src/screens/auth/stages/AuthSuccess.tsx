import type { Space, SyncState, SyncView } from '@renderer/types'
import { SpaceMonogram } from '@renderer/components/app/SpaceMonogram'
import { Button, SyncStatus } from '@renderer/components/ui'
import { AuthHead } from '@renderer/screens/auth/AuthShell'

export interface AuthSuccessProps {
  spaces: Space[]
  sync: SyncView
  onRetry: () => void
  onContinue: () => void
}

const emptyListMessage: Record<SyncState, string> = {
  syncing: 'Reading your spaces…',
  synced: 'No spaces on this account yet.',
  offline: 'Your spaces will show once Anytype is back.',
  error: 'Your spaces could not be read.'
}

export function AuthSuccess({
  spaces,
  sync,
  onRetry,
  onContinue
}: AuthSuccessProps): React.JSX.Element {
  const totalObjects = spaces.reduce((total, space) => total + space.objects, 0)
  return (
    <>
      <AuthHead
        icon="calendar-check"
        title="Connected to your account"
        body="The key is saved on this computer and covers every space on the account. Pick which ones to show next."
      />
      <ul className="mb-16 flex list-none flex-col gap-6 rounded-8 bg-surface-sunken p-12">
        {spaces.length === 0 ? (
          <li className="type-ui text-small text-ink-tertiary">{emptyListMessage[sync.state]}</li>
        ) : (
          spaces.map((space) => (
            <li key={space.key} className="flex items-center gap-8">
              <SpaceMonogram space={space} />
              <span className="flex-1 type-ui text-small text-ink-body">{space.name}</span>
              <span className="type-numeral text-tiny text-ink-tertiary">{space.objects} dated</span>
            </li>
          ))
        )}
      </ul>
      <div className="mb-20 flex items-center justify-between">
        <SyncStatus state={sync.state} detail={sync.detail} compact />
        {sync.state === 'error' ? (
          <Button variant="quiet" size="sm" iconLeft="refresh-cw" onClick={onRetry}>
            Try again
          </Button>
        ) : spaces.length > 0 ? (
          <span className="type-numeral text-tiny text-ink-secondary">
            {spaces.length} spaces · {totalObjects} objects
          </span>
        ) : null}
      </div>
      <Button variant="primary" size="lg" fullWidth iconRight="chevron-right" onClick={onContinue}>
        Choose spaces and types
      </Button>
    </>
  )
}
