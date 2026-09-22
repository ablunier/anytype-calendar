import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { IconName } from '@renderer/types'
import { Wordmark } from '@renderer/components/app/Wordmark'
import { Icon } from '@renderer/components/ui'

export interface AuthShellProps {
  children: ReactNode
}

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

export function PrivacyNote(): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <p className="mt-16 text-center type-caption text-tiny text-ink-tertiary">
      {t('auth.footer.privacyNote')}
    </p>
  )
}
