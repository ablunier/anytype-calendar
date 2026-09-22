import { useTranslation } from 'react-i18next'
import type { ObjectType } from '@renderer/types'
import { TypeTile } from '@renderer/components/app/TypeTile'
import { Checkbox, Select } from '@renderer/components/ui'
import { dateOptions } from '@renderer/lib/calendar'

export interface TypeCardProps {
  type: ObjectType
  checked: boolean
  from: string
  to: string | null
  includesTime: boolean
  onToggle: () => void
  onFromChange: (value: string) => void
  onToChange: (value: string | null) => void
  onIncludesTimeChange: (value: boolean) => void
}

/**
 * The design nests the whole row in a clickable div with role="checkbox"; here the
 * checkbox is the real control and carries the label, so the card is keyboard-operable
 * and the two selects stay independently reachable.
 */
export function TypeCard({
  type,
  checked,
  from,
  to,
  includesTime,
  onToggle,
  onFromChange,
  onToChange,
  onIncludesTimeChange
}: TypeCardProps): React.JSX.Element {
  const { t } = useTranslation()
  /** An empty value can never be a property key. */
  const none = { value: '', label: t('common.none') }
  return (
    <div
      className={[
        'rounded-card border transition duration-base ease-standard',
        checked
          ? 'border-line-accent bg-surface-selected shadow-none'
          : 'border-line-subtle bg-surface-card shadow-1'
      ].join(' ')}
    >
      <div className="flex items-center gap-12 p-12">
        <TypeTile type={type} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="type-ui text-base text-ink-primary">{type.label}</span>
        </div>
        <Checkbox
          checked={checked}
          onChange={onToggle}
          ariaLabel={t('common.showTypeObjects', { label: type.label })}
        />
      </div>
      {checked ? (
        <div className="flex flex-col gap-8 px-12 pb-12">
          <div className="grid grid-cols-2 gap-8">
            <Select
              size="sm"
              label={t('common.fromDate')}
              options={dateOptions(type)}
              value={from}
              onChange={onFromChange}
            />
            <Select
              size="sm"
              label={t('common.toDateOptional')}
              options={[none, ...dateOptions(type).filter((option) => option.value !== from)]}
              value={to ?? none.value}
              onChange={(value) => onToChange(value === none.value ? null : value)}
            />
          </div>
          <Checkbox
            checked={includesTime}
            onChange={onIncludesTimeChange}
            label={t('onboarding.typeCard.includesTime')}
            description={t('onboarding.typeCard.includesTimeDescription')}
          />
        </div>
      ) : null}
    </div>
  )
}
