import type { ObjectType, Space, SyncView, TypePicks } from '@renderer/types'
import { SpaceDot } from '@renderer/components/app/SpaceDot'
import { Button, EmptyState } from '@renderer/components/ui'
import { useTypeSelection } from '@renderer/hooks/useTypeSelection'
import { typesInSpace } from '@renderer/lib/calendar'
import { Wordmark } from '@renderer/components/app/Wordmark'
import { SpacePicker } from './SpacePicker'
import { TypeCard } from './TypeCard'

export interface OnboardingScreenProps {
  spaces: Space[]
  types: ObjectType[]
  sync: SyncView
  /** Read once, when the account has first been read. */
  initial: TypePicks
  onRetrySync: () => void
  onContinue: (picks: TypePicks) => void
  onSkip: () => void
}

/** Shown on first run only. */
export function OnboardingScreen({
  spaces,
  types,
  sync,
  initial,
  onRetrySync,
  onContinue,
  onSkip
}: OnboardingScreenProps): React.JSX.Element {
  return (
    <div className="flex h-full flex-col bg-surface-page">
      <header className="flex h-topbar shrink-0 items-center gap-12 border-b border-line-subtle bg-surface-card px-16">
        <Wordmark />
        <span className="type-caption text-tiny text-ink-tertiary">Onboarding</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Skip
        </Button>
      </header>

      {sync.hasResult ? (
        <Picker
          spaces={spaces}
          types={types}
          initial={initial}
          onContinue={onContinue}
          onSkip={onSkip}
        />
      ) : (
        <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-32">
          {sync.state === 'error' ? (
            <EmptyState
              icon="circle-alert"
              title="Read your spaces again"
              description={`Your spaces could not be read. ${sync.detail ?? ''}`}
              action={
                <Button variant="secondary" size="md" iconLeft="refresh-cw" onClick={onRetrySync}>
                  Try again
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon="loader-circle"
              title="Reading your spaces…"
              description="Your types and their dates show here in a moment."
            />
          )}
        </main>
      )}
    </div>
  )
}

interface PickerProps {
  spaces: Space[]
  types: ObjectType[]
  initial: TypePicks
  onContinue: (picks: TypePicks) => void
  onSkip: () => void
}

/** Mounted only once the account has been read, so the selection starts from real types. */
function Picker({ spaces, types, initial, onContinue, onSkip }: PickerProps): React.JSX.Element {
  const selection = useTypeSelection(types, initial)
  const chosenSpaces = spaces.filter((space) => selection.spaceKeys.includes(space.key))

  return (
    <>
      <main className="min-h-0 flex-1 overflow-auto px-32 pt-32 pb-24">
        <div className="mx-auto max-w-1000">
          <h1 className="mb-8 type-title text-h2 text-ink-primary">
            Which objects belong on the calendar?
          </h1>
          <p className="mb-24 max-w-prose-max type-lead text-lead text-pretty text-ink-secondary">
            Your key covers every space on this account. Pick the spaces you want to see, then
            the types inside them. Each type needs one date to start from; a second date turns
            it into a range.
          </p>

          <div className="grid grid-picker items-start gap-32">
            <SpacePicker
              spaces={spaces}
              types={types}
              selectedKeys={selection.spaceKeys}
              onToggle={selection.toggleSpace}
            />

            <div className="flex flex-col gap-20">
              {chosenSpaces.map((space) => {
                const spaceTypes = typesInSpace(types, space.key)
                return (
                  <section key={space.key}>
                    <div className="mb-8 flex items-center gap-8">
                      <SpaceDot space={space} />
                      <h2 className="type-ui text-small text-ink-primary">{space.name}</h2>
                      <span className="type-numeral text-tiny text-ink-tertiary">
                        {spaceTypes.length} dated types
                      </span>
                    </div>
                    {spaceTypes.length === 0 ? (
                      <p className="type-body text-small text-ink-tertiary">
                        No type in this space has a date property yet.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 items-start gap-10">
                        {spaceTypes.map((type) => (
                          <TypeCard
                            key={type.key}
                            type={type}
                            checked={selection.typeKeys.includes(type.key)}
                            from={selection.mappingFor(type).from}
                            to={selection.mappingFor(type).to}
                            onToggle={() => selection.toggleType(type.key)}
                            onFromChange={(value) => selection.setFrom(type.key, value)}
                            onToChange={(value) => selection.setTo(type.key, value)}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )
              })}
              {chosenSpaces.length === 0 ? (
                <p className="type-body text-small text-ink-tertiary">
                  Pick a space to see the types inside it.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </main>

      <footer className="flex shrink-0 items-center gap-12 border-t border-line-subtle bg-surface-card px-24 py-12">
        <span className="type-numeral text-small text-ink-secondary">
          {chosenSpaces.length} spaces · {selection.activeTypes.length} types ·{' '}
          {selection.objectCount} objects
        </span>
        <div className="flex-1" />
        <Button variant="ghost" size="md" onClick={onSkip}>
          Skip for now
        </Button>
        <Button
          variant="primary"
          size="md"
          iconRight="chevron-right"
          onClick={() => onContinue(selection.picks)}
        >
          Continue
        </Button>
      </footer>
    </>
  )
}
