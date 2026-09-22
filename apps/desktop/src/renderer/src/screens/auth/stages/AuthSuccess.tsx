import { useTranslation } from 'react-i18next'
import type { Space, SyncState, SyncView } from '@renderer/types'
import { SpaceMonogram } from '@renderer/components/app/SpaceMonogram'
import { Button, SyncStatus } from '@renderer/components/ui'
import { syncDetailText } from '@renderer/lib/sync-text'
import { AuthHead } from '@renderer/screens/auth/AuthShell'

export interface AuthSuccessProps {
  spaces: Space[]
  sync: SyncView
  onRetry: () => void
  onContinue: () => void
}

export function AuthSuccess({
  spaces,
  sync,
  onRetry,
  onContinue
}: AuthSuccessProps): React.JSX.Element {
  const { t } = useTranslation()
  const emptyListMessage: Record<SyncState, string> = {
    syncing: t('auth.success.emptyList.syncing'),
    synced: t('auth.success.emptyList.synced'),
    offline: t('auth.success.emptyList.offline'),
    error: t('auth.success.emptyList.error')
  }

  return (
    <>
      <AuthHead
        icon="calendar-check"
        title={t('auth.success.title')}
        body={t('auth.success.body')}
      />
      <ul className="mb-16 flex list-none flex-col gap-6 rounded-8 bg-surface-sunken p-12">
        {spaces.length === 0 ? (
          <li className="type-ui text-small text-ink-tertiary">{emptyListMessage[sync.state]}</li>
        ) : (
          spaces.map((space) => (
            <li key={space.key} className="flex items-center gap-8">
              <SpaceMonogram space={space} />
              <span className="flex-1 type-ui text-small text-ink-body">{space.name}</span>
            </li>
          ))
        )}
      </ul>
      <div className="mb-20 flex items-center justify-between">
        <SyncStatus state={sync.state} detail={syncDetailText(t, sync.detail)} compact />
        {sync.state === 'error' ? (
          <Button variant="quiet" size="sm" iconLeft="refresh-cw" onClick={onRetry}>
            {t('common.tryAgain')}
          </Button>
        ) : spaces.length > 0 ? (
          <span className="type-numeral text-tiny text-ink-secondary">
            {t('common.spacesCount', { count: spaces.length })}
          </span>
        ) : null}
      </div>
      <Button variant="primary" size="lg" fullWidth iconRight="chevron-right" onClick={onContinue}>
        {t('auth.success.continue')}
      </Button>
    </>
  )
}
