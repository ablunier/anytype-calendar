import { useEffect, useState } from 'react'
import type { ApiKeyView } from '@renderer/types'
import { Button, Card, Icon, IconButton } from '@renderer/components/ui'
import { isoDate } from '@renderer/lib/calendar'

export interface SessionSectionProps {
  apiKey: ApiKeyView
  /** Resolves whether a key was copied. */
  onCopyKey: () => Promise<boolean>
  onSignOut: () => void
}

const COPIED_FEEDBACK_MS = 2_000

function keySummary({ hint, issuedAt }: ApiKeyView): string {
  const issued = new Date(issuedAt)
  const added = isoDate(issued.getFullYear(), issued.getMonth(), issued.getDate())
  return `••••••••••••${hint} · added ${added} · account-wide`
}

export function SessionSection({
  apiKey,
  onCopyKey,
  onSignOut
}: SessionSectionProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async (): Promise<void> => {
    if (await onCopyKey()) setCopied(true)
  }

  return (
    <>
      <section>
        <h2 className="mb-10 type-heading text-h4 text-ink-primary">Session</h2>
        <Card>
          <div className="flex items-center gap-12 border-b border-line-hairline pb-12">
            <Icon name="shield-check" size={16} className="text-ink-tertiary" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="type-ui text-small text-ink-primary">API key</span>
              <span className="truncate type-numeral text-tiny text-ink-tertiary">
                {keySummary(apiKey)}
              </span>
            </div>
            <IconButton
              icon={copied ? 'check' : 'copy'}
              label={copied ? 'Key copied' : 'Copy key'}
              onClick={() => void copy()}
            />
          </div>
          <div className="flex items-center gap-12 pt-12">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="type-ui text-small text-ink-primary">
                Sign out of this computer
              </span>
              <span className="type-caption text-tiny text-ink-secondary">
                Forgets the key here. It stays valid in Anytype until you delete it there.
              </span>
            </div>
            <Button variant="secondary" size="sm" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </Card>
      </section>

      {/* The local API cannot delete keys, so revoking is done in Anytype itself. */}
      <section>
        <h2 className="mb-10 type-heading text-h4 text-ink-primary">Revoke access</h2>
        <Card>
          <div className="flex items-start gap-12">
            <Icon name="info" size={16} className="mt-2 text-ink-tertiary" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="type-ui text-small text-ink-primary">Revoke API key</span>
              <span className="max-w-prose-max type-caption text-tiny text-ink-body">
                To revoke it for every space on the account, open the Anytype app, go to
                Settings → API Keys and delete the key ending in {apiKey.hint}. Then sign out
                here. Reconnecting means running the 4-digit code flow again.
              </span>
            </div>
          </div>
        </Card>
      </section>
    </>
  )
}
