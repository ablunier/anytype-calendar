import { Wordmark } from '@renderer/components/app/Wordmark'
import { IconButton, SyncStatus } from '@renderer/components/ui'

export interface MonthTopBarProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onOpenSettings: () => void
}

export function MonthTopBar({
  theme,
  onToggleTheme,
  onOpenSettings
}: MonthTopBarProps): React.JSX.Element {
  return (
    <header className="flex h-topbar shrink-0 items-center gap-12 border-b border-line-subtle bg-surface-card pr-12 pl-16">
      <Wordmark />
      <div className="flex-1" />
      <SyncStatus state="synced" detail="2 min ago" compact />
      <IconButton icon="refresh-cw" label="Re-read account" />
      <IconButton
        icon={theme === 'dark' ? 'sun' : 'moon'}
        label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        onClick={onToggleTheme}
      />
      <IconButton icon="settings" label="Settings" onClick={onOpenSettings} />
    </header>
  )
}
