import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ApiAccessView, ApiKeyView } from '@renderer/types'
import { Button, Card, Icon, IconButton } from '@renderer/components/ui'
import { API_KEYS_BREADCRUMB } from '@renderer/lib/anytype-menu'
import { isoDate } from '@renderer/lib/calendar'

export interface SessionSectionProps {
  apiKey: ApiKeyView
  /** Null until Anytype has been asked what the key reaches. */
  access: ApiAccessView | null
  /** Resolves whether a key was copied. */
  onCopyKey: () => Promise<boolean>
  onSignOut: () => void
}

const COPIED_FEEDBACK_MS = 2_000

export function SessionSection({
  apiKey,
  access,
  onCopyKey,
  onSignOut
}: SessionSectionProps): React.JSX.Element {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const keySummary = ({ hint, issuedAt }: ApiKeyView): string => {
    const issued = new Date(issuedAt)
    const added = isoDate(issued.getFullYear(), issued.getMonth(), issued.getDate())
    return t('config.session.keySummary', { hint, added })
  }

  /* The major is all v1 can say. Never whoami's own `api.version`: it names v1's date even
   * over v2. */
  const accessSummary = (view: ApiAccessView): string => {
    if (view.version === 'v1') return t('config.session.accessV1')
    return [
      t('config.session.accessV2'),
      view.spaceCount === null
        ? t('config.session.allSpaces')
        : t('common.spacesCount', { count: view.spaceCount }),
      view.canEdit ? t('config.session.canEdit') : t('config.session.readOnly')
    ].join(' · ')
  }

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
        <h2 className="mb-10 type-heading text-h4 text-ink-primary">{t('config.session.heading')}</h2>
        <Card>
          <div className="flex items-center gap-12 border-b border-line-hairline pb-12">
            <Icon name="shield-check" size={16} className="text-ink-tertiary" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="type-ui text-small text-ink-primary">{t('config.session.apiKey')}</span>
              <span className="truncate type-numeral text-tiny text-ink-tertiary">
                {keySummary(apiKey)}
              </span>
            </div>
            <IconButton
              icon={copied ? 'check' : 'copy'}
              label={copied ? t('config.session.keyCopied') : t('config.session.copyKey')}
              onClick={() => void copy()}
            />
          </div>
          <div className="flex items-center gap-12 border-b border-line-hairline py-12">
            <Icon name="database" size={16} className="text-ink-tertiary" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="type-ui text-small text-ink-primary">{t('config.session.api')}</span>
              <span className="truncate type-caption text-tiny text-ink-tertiary">
                {access ? accessSummary(access) : t('config.session.accessUnknown')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-12 pt-12">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="type-ui text-small text-ink-primary">
                {t('config.session.signOutTitle')}
              </span>
              <span className="type-caption text-tiny text-ink-secondary">
                {t('config.session.signOutDescription')}
              </span>
            </div>
            <Button variant="secondary" size="sm" onClick={onSignOut}>
              {t('config.session.signOut')}
            </Button>
          </div>
        </Card>
      </section>

      {/* The local API cannot delete keys, so revoking is done in Anytype itself. */}
      <section>
        <h2 className="mb-10 type-heading text-h4 text-ink-primary">
          {t('config.session.revokeHeading')}
        </h2>
        <Card>
          <div className="flex items-start gap-12">
            <Icon name="info" size={16} className="mt-2 text-ink-tertiary" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="type-ui text-small text-ink-primary">
                {t('config.session.revokeTitle')}
              </span>
              <span className="max-w-prose-max type-caption text-tiny text-ink-body">
                {t('config.session.revokeInstructions', { breadcrumb: API_KEYS_BREADCRUMB })}
              </span>
            </div>
          </div>
        </Card>
      </section>
    </>
  )
}
