import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ApiKeyView, ObjectType, Space, SyncView, TypePicks } from '@renderer/types'
import { Wordmark } from '@renderer/components/app/Wordmark'
import { Button, Card, Checkbox, EmptyState, Icon, Select, SyncStatus } from '@renderer/components/ui'
import { useTypeSelection, type TypeSelection } from '@renderer/hooks/useTypeSelection'
import { typesInSpace, weekdayNames } from '@renderer/lib/calendar'
import { syncDetailText } from '@renderer/lib/sync-text'
import type { LanguageSnapshot, TimeFormatSnapshot } from '@shared/ipc'
import { SessionSection } from './SessionSection'
import { SpaceTypesCard } from './SpaceTypesCard'

export interface ConfigScreenProps {
  spaces: Space[]
  types: ObjectType[]
  sync: SyncView
  /** Read once, when the account has first been read. */
  initial: TypePicks
  apiKey: ApiKeyView
  /** Null: following the OS language ("System default" in the Select). */
  language: LanguageSnapshot
  onLanguage: (language: LanguageSnapshot) => void
  showWeekNumbers: boolean
  onShowWeekNumbers: (shown: boolean) => void
  /** Monday is 0, Sunday 6. */
  weekStart: number
  onWeekStart: (day: number) => void
  timeFormat: TimeFormatSnapshot
  onTimeFormat: (format: TimeFormatSnapshot) => void
  onBack: () => void
  onReread: () => void
  /** Rejects when the picks could not be saved. */
  onSave: (picks: TypePicks) => Promise<void>
  onCopyKey: () => Promise<boolean>
  onSignOut: () => void
}

/**
 * The picks start from the saved selection over the synced types, so they must not start
 * before the account has been read: over no types every saved date would fall back, and
 * the first save would write those fallbacks. The first read remounts the screen instead.
 */
export function ConfigScreen(props: ConfigScreenProps): React.JSX.Element {
  return <Settings key={props.sync.hasResult ? 'read' : 'unread'} {...props} />
}

function Settings({
  spaces,
  types,
  sync,
  initial,
  apiKey,
  language,
  onLanguage,
  showWeekNumbers,
  onShowWeekNumbers,
  weekStart,
  onWeekStart,
  timeFormat,
  onTimeFormat,
  onBack,
  onReread,
  onSave,
  onCopyKey,
  onSignOut
}: ConfigScreenProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const selection = useTypeSelection(types, initial)
  const [saveFailed, setSaveFailed] = useState(false)

  const save = (picks: TypePicks): void => {
    // Saves land in order, and each carries every pick, so the last to settle has the say.
    onSave(picks).then(
      () => setSaveFailed(false),
      () => setSaveFailed(true)
    )
  }

  /* Every change is saved as it is made. Keyed on the picks object rather than on a first-run
   * flag, so StrictMode running the effect twice on mount saves nothing. */
  const sent = useRef(selection.picks)
  useEffect(() => {
    if (selection.picks === sent.current) return
    sent.current = selection.picks
    save(selection.picks)
  }, [selection.picks])

  const read = sync.hasResult
  const syncing = sync.state === 'syncing'

  return (
    <div className="flex h-full flex-col bg-surface-page">
      <header className="flex h-topbar shrink-0 items-center gap-12 border-b border-line-subtle bg-surface-card px-16">
        <Wordmark />
        <div className="flex-1" />
        <Button variant="ghost" size="sm" iconLeft="chevron-left" onClick={onBack}>
          {t('config.backToCalendar')}
        </Button>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-32">
        <div className="mx-auto flex max-w-820 flex-col gap-32">
          <div>
            <h1 className="mb-4 type-heading text-h3 text-ink-primary">{t('config.title')}</h1>
            <p className="type-body text-small text-ink-secondary">{t('config.intro')}</p>
          </div>

          <section>
            <h2 className="mb-10 type-heading text-h4 text-ink-primary">{t('config.account')}</h2>
            <Card>
              <div className="flex items-center gap-12">
                <SyncStatus state={sync.state} detail={syncDetailText(t, sync.detail)} />
                <div className="flex-1" />
                {read ? (
                  <span className="type-numeral text-tiny text-ink-secondary">
                    {t('common.spacesCount', { count: spaces.length })}
                  </span>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  iconLeft="refresh-cw"
                  loading={syncing}
                  onClick={onReread}
                >
                  {t('config.rereadAccount')}
                </Button>
              </div>
            </Card>
          </section>

          <section>
            <div className="mb-10 flex items-baseline gap-8">
              <h2 className="type-heading text-h4 text-ink-primary">{t('config.spacesAndTypes')}</h2>
              <span className="type-caption text-tiny text-ink-tertiary">
                {t('config.spacesAndTypesDescription')}
              </span>
            </div>
            {read ? (
              <SpacesAndTypes
                spaces={spaces}
                types={types}
                selection={selection}
                syncing={syncing}
                saveFailed={saveFailed}
                onReread={onReread}
                onRetrySave={() => save(selection.picks)}
              />
            ) : (
              <Card>
                {sync.state === 'error' ? (
                  <EmptyState
                    compact
                    icon="circle-alert"
                    title={t('common.readAgain')}
                    description={t('common.spacesUnreadable', {
                      detail: syncDetailText(t, sync.detail) ?? ''
                    })}
                    action={
                      <Button
                        variant="secondary"
                        size="md"
                        iconLeft="refresh-cw"
                        onClick={onReread}
                      >
                        {t('common.tryAgain')}
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    compact
                    icon="loader-circle"
                    title={t('common.reading')}
                    description={t('common.readingDescription')}
                  />
                )}
              </Card>
            )}
          </section>

          <section>
            <h2 className="mb-10 type-heading text-h4 text-ink-primary">{t('config.calendar')}</h2>
            <Card className="flex flex-col gap-16">
              <Select
                label={t('config.language')}
                options={[
                  { value: '', label: t('config.languageSystem') },
                  { value: 'en', label: 'English' },
                  { value: 'es', label: 'Español' },
                  { value: 'gl', label: 'Galego' }
                ]}
                value={language ?? ''}
                onChange={(value) => onLanguage(value === '' ? null : (value as 'en' | 'es' | 'gl'))}
              />
              <Select
                label={t('config.firstDayOfWeek')}
                options={weekdayNames(i18n.language, 'long').map((name, index) => ({
                  value: String(index),
                  label: name
                }))}
                value={String(weekStart)}
                onChange={(value) => onWeekStart(Number(value))}
              />
              <Select
                label={t('config.timeFormat')}
                options={[
                  { value: '24h', label: t('config.timeFormat24h') },
                  { value: '12h', label: t('config.timeFormat12h') }
                ]}
                value={timeFormat}
                onChange={(value) => onTimeFormat(value === '12h' ? '12h' : '24h')}
              />
              <Checkbox
                checked={showWeekNumbers}
                onChange={onShowWeekNumbers}
                label={t('config.showWeekNumbers')}
                description={t('config.showWeekNumbersDescription')}
              />
            </Card>
          </section>

          <SessionSection apiKey={apiKey} onCopyKey={onCopyKey} onSignOut={onSignOut} />
        </div>
      </main>
    </div>
  )
}

interface SpacesAndTypesProps {
  spaces: Space[]
  types: ObjectType[]
  selection: TypeSelection
  syncing: boolean
  saveFailed: boolean
  onReread: () => void
  onRetrySave: () => void
}

function SpacesAndTypes({
  spaces,
  types,
  selection,
  syncing,
  saveFailed,
  onReread,
  onRetrySave
}: SpacesAndTypesProps): React.JSX.Element {
  const { t } = useTranslation()
  if (spaces.length === 0) {
    return (
      <Card>
        <EmptyState
          compact
          icon="layers"
          title={t('config.createSpace')}
          description={t('config.createSpaceDescription')}
          action={
            <Button
              variant="secondary"
              size="md"
              iconLeft="refresh-cw"
              loading={syncing}
              onClick={onReread}
            >
              {t('config.rereadAccount')}
            </Button>
          }
        />
      </Card>
    )
  }

  return (
    <>
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
      {saveFailed ? (
        <div className="mt-8 flex items-center gap-8">
          <Icon name="circle-alert" size={14} className="text-ink-danger" />
          <span className="type-caption text-tiny text-ink-danger">
            {t('config.lastChangeFailed')}
          </span>
          <Button variant="quiet" size="sm" onClick={onRetrySave}>
            {t('common.tryAgain')}
          </Button>
        </div>
      ) : (
        <p className="mt-8 type-caption text-tiny text-ink-tertiary">{t('config.changesApply')}</p>
      )}
    </>
  )
}
