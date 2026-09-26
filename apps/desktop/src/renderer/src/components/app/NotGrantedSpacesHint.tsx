import { useTranslation } from 'react-i18next'
import { Icon } from '@renderer/components/ui'
import { API_KEYS_BREADCRUMB } from '@renderer/lib/anytype-menu'

/** For when the key's grant leaves some of the account's spaces out of every list here. */
export function NotGrantedSpacesHint(): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div className="flex items-start gap-8 rounded-6 border border-line-subtle bg-surface-card px-12 py-10">
      <Icon name="eye-off" size={14} className="mt-2 text-ink-tertiary" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="type-ui text-small text-ink-primary">{t('common.notGrantedTitle')}</span>
        <span className="max-w-prose-max type-caption text-tiny text-ink-secondary">
          {t('common.notGrantedDescription', { breadcrumb: API_KEYS_BREADCRUMB })}
        </span>
      </div>
    </div>
  )
}
