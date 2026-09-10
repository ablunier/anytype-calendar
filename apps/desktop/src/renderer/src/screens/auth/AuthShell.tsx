import type { ReactNode } from 'react'
import type { IconName } from '../../types'
import { Wordmark } from '../../components/app/Wordmark'
import { Icon } from '../../components/ui'

export interface AuthShellProps {
  children: ReactNode
}

/** Top bar plus a centred 440px column — the frame every auth state sits in. */
export function AuthShell({ children }: AuthShellProps): React.JSX.Element {
  return (
    <div className="flex h-full flex-col bg-surface-page">
      <header className="flex h-topbar shrink-0 items-center border-b border-line-subtle bg-surface-card px-16">
        <Wordmark />
      </header>
      <main className="flex min-h-0 flex-1 items-center justify-center p-32">
        <div className="w-440">{children}</div>
      </main>
    </div>
  )
}

export interface AuthHeadProps {
  icon: IconName
  title: string
  body: string
  tone?: 'accent' | 'danger'
}

const toneClass = {
  accent: 'bg-surface-accent-soft text-ink-accent',
  danger: 'bg-surface-danger-soft text-ink-danger'
} as const

/** Icon tile, heading and one short paragraph — the head of every auth card. */
export function AuthHead({ icon, title, body, tone = 'accent' }: AuthHeadProps): React.JSX.Element {
  return (
    <div className="mb-20 flex flex-col gap-12">
      <span
        className={['flex size-40 items-center justify-center rounded-10', toneClass[tone]].join(' ')}
      >
        <Icon name={icon} size={20} />
      </span>
      <h1 className="type-heading text-h3 text-ink-primary">{title}</h1>
      <p className="type-body text-small text-pretty text-ink-secondary">{body}</p>
    </div>
  )
}

/** Privacy is stated plainly, once. */
export function PrivacyNote(): React.JSX.Element {
  return (
    <p className="mt-16 text-center type-caption text-tiny text-ink-tertiary">
      Keys are stored on this computer only. No account, no server copy.
    </p>
  )
}
