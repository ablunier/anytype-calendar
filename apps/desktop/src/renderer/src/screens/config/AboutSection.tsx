import { useTranslation } from 'react-i18next'
import { Button, Card, Icon } from '@renderer/components/ui'

export interface AboutSectionProps {
  /** Null until main has answered. */
  version: string | null
  /** A newer release's version, shown even after its notice was closed. */
  updateAvailable: string | null
  onOpenRelease: () => void
}

export function AboutSection({
  version,
  updateAvailable,
  onOpenRelease
}: AboutSectionProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <section>
      <h2 className="mb-10 type-heading text-h4 text-ink-primary">{t('config.about.heading')}</h2>
      <Card>
        <div className="flex items-center gap-12">
          <Icon name="info" size={16} className="text-ink-tertiary" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="type-ui text-small text-ink-primary">{t('config.about.version')}</span>
            <span className="truncate type-numeral text-tiny text-ink-tertiary">
              {version ?? '…'}
            </span>
          </div>
          {updateAvailable ? (
            <Button variant="secondary" size="sm" iconLeft="arrow-up-right" onClick={onOpenRelease}>
              {t('updates.available', { version: updateAvailable })}
            </Button>
          ) : null}
        </div>
      </Card>
    </section>
  )
}
