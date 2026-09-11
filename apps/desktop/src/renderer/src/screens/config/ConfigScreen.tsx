import { useState } from 'react'
import type { ApiKeyView, ObjectType, Space } from '@renderer/types'
import { SpaceChip } from '@renderer/components/app/SpaceDot'
import { Wordmark } from '@renderer/components/app/Wordmark'
import { Button, Card, SyncStatus } from '@renderer/components/ui'
import { useTypeSelection } from '@renderer/hooks/useTypeSelection'
import { typesInSpace } from '@renderer/lib/calendar'
import { RevokeDialog } from './RevokeDialog'
import { SessionSection } from './SessionSection'
import { SpaceTypesCard } from './SpaceTypesCard'

export interface ConfigScreenProps {
  spaces: Space[]
  types: ObjectType[]
  initialTypeKeys: string[]
  initialSpaceKeys: string[]
  apiKey: ApiKeyView
  /** Opens the revoke dialog on mount — the flow shows this as its own frame. */
  confirmingRevoke?: boolean
  onBack: () => void
  onCopyKey: () => Promise<boolean>
  onSignOut: () => void
  onRevoke: () => Promise<void>
}

export function ConfigScreen({
  spaces,
  types,
  initialTypeKeys,
  initialSpaceKeys,
  apiKey,
  confirmingRevoke = false,
  onBack,
  onCopyKey,
  onSignOut,
  onRevoke
}: ConfigScreenProps): React.JSX.Element {
  const selection = useTypeSelection(types, initialTypeKeys, initialSpaceKeys)
  const [revoking, setRevoking] = useState(confirmingRevoke)

  return (
    <div className="flex h-full flex-col bg-surface-page">
      <header className="flex h-topbar shrink-0 items-center gap-12 border-b border-line-subtle bg-surface-card px-16">
        <Wordmark />
        <SpaceChip
          label={`${selection.spaceKeys.length} of ${spaces.length} spaces`}
          hues={spaces
            .filter((space) => selection.spaceKeys.includes(space.key))
            .map((space) => space.category)}
        />
        <div className="flex-1" />
        <Button variant="ghost" size="sm" iconLeft="chevron-left" onClick={onBack}>
          Back to calendar
        </Button>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-32">
        <div className="mx-auto flex max-w-820 flex-col gap-32">
          <div>
            <h1 className="mb-4 type-heading text-h3 text-ink-primary">Settings</h1>
            <p className="type-body text-small text-ink-secondary">
              One key, read through the Anytype app on this computer. It covers every space on
              the account.
            </p>
          </div>

          <section>
            <h2 className="mb-10 type-heading text-h4 text-ink-primary">Account</h2>
            <Card>
              <div className="flex items-center gap-12">
                <SyncStatus state="synced" detail="2 min ago" />
                <div className="flex-1" />
                <span className="type-numeral text-tiny text-ink-secondary">
                  {spaces.length} spaces · {selection.objectCount} objects on the grid
                </span>
                <Button variant="ghost" size="sm" iconLeft="refresh-cw">
                  Re-read account
                </Button>
              </div>
            </Card>
          </section>

          <section>
            <div className="mb-10 flex items-baseline gap-8">
              <h2 className="type-heading text-h4 text-ink-primary">Spaces and types</h2>
              <span className="type-caption text-tiny text-ink-tertiary">
                Which types generate events, and which dates they use
              </span>
            </div>
            <div className="flex flex-col gap-12">
              {spaces.map((space) => (
                <SpaceTypesCard
                  key={space.key}
                  space={space}
                  types={typesInSpace(types, space.key)}
                  selection={selection}
                />
              ))}
            </div>
            <p className="mt-8 type-caption text-tiny text-ink-tertiary">
              Changes apply to the grid immediately. A type with a to date is drawn as a range.
            </p>
          </section>

          <SessionSection
            apiKey={apiKey}
            onCopyKey={onCopyKey}
            onSignOut={onSignOut}
            onRevokeRequest={() => setRevoking(true)}
          />
        </div>
      </main>

      <RevokeDialog
        open={revoking}
        spaceCount={spaces.length}
        onClose={() => setRevoking(false)}
        onRevoke={onRevoke}
      />
    </div>
  )
}
