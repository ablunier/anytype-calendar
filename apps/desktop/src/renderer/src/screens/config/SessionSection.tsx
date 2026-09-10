import { Button, Card, Icon, IconButton } from '../../components/ui'

export interface SessionSectionProps {
  onSignOut: () => void
  onRevokeRequest: () => void
}

const KEY_SUMMARY = 'ak_••••••••••••4c19 · added 2026-03-01 · account-wide'

/** The stored key, signing out, and the destructive revoke. */
export function SessionSection({
  onSignOut,
  onRevokeRequest
}: SessionSectionProps): React.JSX.Element {
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
                {KEY_SUMMARY}
              </span>
            </div>
            <IconButton icon="eye" label="Reveal key" />
            <IconButton icon="copy" label="Copy key" />
          </div>
          <div className="flex items-center gap-12 pt-12">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="type-ui text-small text-ink-primary">
                Sign out of this computer
              </span>
              <span className="type-caption text-tiny text-ink-secondary">
                Forgets the key here. The key stays valid in Anytype, so you can sign back in
                with it.
              </span>
            </div>
            <Button variant="secondary" size="sm" onClick={onSignOut}>
              Sign out
            </Button>
          </div>
        </Card>
      </section>

      <section>
        <h2 className="mb-10 type-heading text-h4 text-ink-primary">Revoke access</h2>
        <div className="flex items-start gap-12 rounded-card border border-clay-300 bg-surface-danger-soft p-16">
          <Icon name="circle-alert" size={16} className="mt-2 text-clay-600" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="type-ui text-small text-ink-primary">Revoke API key</span>
            <span className="max-w-prose-max type-caption text-tiny text-ink-body">
              Deletes the key in Anytype as well, for every space on the account. This cannot
              be undone — you will have to run the 4-digit code flow again to reconnect.
            </span>
          </div>
          <Button variant="danger" size="sm" iconLeft="trash" onClick={onRevokeRequest}>
            Revoke key
          </Button>
        </div>
      </section>
    </>
  )
}
