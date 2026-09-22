import { useTranslation } from 'react-i18next'
import type { SyncView } from '@renderer/types'
import { Wordmark } from '@renderer/components/app/Wordmark'
import { IconButton, SyncStatus } from '@renderer/components/ui'
import { syncDetailText } from '@renderer/lib/sync-text'

export interface MonthTopBarProps {
  sync: SyncView
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onOpenSettings: () => void
  onReread: () => void
}

export function MonthTopBar({
  sync,
  theme,
  onToggleTheme,
  onOpenSettings,
  onReread
}: MonthTopBarProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <header className="flex h-topbar shrink-0 items-center gap-12 border-b border-line-subtle bg-surface-card pr-12 pl-16">
      <Wordmark />
      <div className="flex-1" />
      <SyncStatus state={sync.state} detail={syncDetailText(t, sync.detail)} compact />
      <IconButton icon="refresh-cw" label={t('month.topbar.rereadAccount')} onClick={onReread} />
      <IconButton
        icon={theme === 'dark' ? 'sun' : 'moon'}
        label={theme === 'dark' ? t('month.topbar.switchToLight') : t('month.topbar.switchToDark')}
        onClick={onToggleTheme}
      />
      <IconButton icon="settings" label={t('month.topbar.settings')} onClick={onOpenSettings} />
    </header>
  )
}
