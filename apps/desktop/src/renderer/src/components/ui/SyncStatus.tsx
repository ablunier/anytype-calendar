import type { IconName, SyncState } from '@renderer/types'
import { Icon } from './Icon'

interface SyncPresentation {
  icon: IconName
  label: string
  fg: string
  bg: string
}

/* The system's own SyncStatus asks for a `check-check` glyph, which is not one of the
 * icons it vendors — it would render as an empty mask. `check` is the nearest stem that
 * actually ships, so it stands in for the synced state. */
const presentation: Record<SyncState, SyncPresentation> = {
  synced: { icon: 'check', label: 'Synced', fg: 'text-ink-accent', bg: 'bg-surface-accent-soft' },
  syncing: { icon: 'refresh-cw', label: 'Syncing', fg: 'text-ochre-600', bg: 'bg-ochre-050' },
  offline: { icon: 'unplug', label: 'Offline', fg: 'text-ink-secondary', bg: 'bg-surface-sunken' },
  error: {
    icon: 'circle-alert',
    label: 'Sync failed',
    fg: 'text-ink-danger',
    bg: 'bg-surface-danger-soft'
  }
}

export interface SyncStatusProps {
  state?: SyncState
  detail?: string
  label?: string
  /** Strips the padded, tinted pill for use inside a toolbar. */
  compact?: boolean
}

export function SyncStatus({
  state = 'synced',
  detail,
  label,
  compact = false
}: SyncStatusProps): React.JSX.Element {
  const s = presentation[state]
  return (
    <div
      className={[
        'flex items-center gap-8 rounded-6',
        compact ? '' : `px-8 py-6 ${s.bg}`
      ].join(' ')}
    >
      <Icon
        name={s.icon}
        size={14}
        className={[s.fg, state === 'syncing' ? 'animate-spinner-slow' : ''].join(' ')}
      />
      <span className="flex flex-col leading-numeral">
        <span className={['type-ui text-tiny', s.fg].join(' ')}>{label ?? s.label}</span>
        {detail ? (
          <span className="type-numeral text-micro text-ink-tertiary">{detail}</span>
        ) : null}
      </span>
    </div>
  )
}
