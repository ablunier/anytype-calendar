import { useTranslation } from 'react-i18next'
import type { SyncView } from '@renderer/types'
import { Wordmark } from '@renderer/components/app/Wordmark'
import { Button, IconButton, SyncStatus } from '@renderer/components/ui'
import { syncDetailText } from '@renderer/lib/sync-text'

export interface CalendarTopBarProps {
  sync: SyncView
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onOpenSettings: () => void
  onReread: () => void
  /** A newer release's version, while its notice has not been closed. */
  updateNotice: string | null
  onOpenRelease: () => void
  onDismissUpdate: () => void
}

export function CalendarTopBar({
  sync,
  theme,
  onToggleTheme,
  onOpenSettings,
  onReread,
  updateNotice,
  onOpenRelease,
  onDismissUpdate
}: CalendarTopBarProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <header className="flex h-topbar shrink-0 items-center gap-12 border-b border-line-subtle bg-surface-card pr-12 pl-16">
      <Wordmark />
      <div className="flex-1" />
      {updateNotice ? (
        <div className="flex items-center gap-2 rounded-control bg-surface-accent-soft pr-2">
          <Button variant="quiet" size="sm" iconLeft="arrow-up-right" onClick={onOpenRelease}>
            {t('updates.available', { version: updateNotice })}
          </Button>
          <IconButton icon="x" size="sm" label={t('updates.dismiss')} onClick={onDismissUpdate} />
        </div>
      ) : null}
      <SyncStatus state={sync.state} detail={syncDetailText(t, sync.detail)} compact />
      <IconButton icon="refresh-cw" label={t('calendar.topbar.rereadAccount')} onClick={onReread} />
      <IconButton
        icon={theme === 'dark' ? 'sun' : 'moon'}
        label={theme === 'dark' ? t('calendar.topbar.switchToLight') : t('calendar.topbar.switchToDark')}
        onClick={onToggleTheme}
      />
      <IconButton icon="settings" label={t('calendar.topbar.settings')} onClick={onOpenSettings} />
    </header>
  )
}
