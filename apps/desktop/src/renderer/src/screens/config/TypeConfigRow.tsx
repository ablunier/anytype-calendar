import { useTranslation } from 'react-i18next'
import type { ObjectType } from '@renderer/types'
import { TypeTile } from '@renderer/components/app/TypeTile'
import { Checkbox, Select } from '@renderer/components/ui'
import { colourOptions, dateOptions } from '@renderer/lib/calendar'

export interface TypeConfigRowProps {
  type: ObjectType
  checked: boolean
  from: string
  to: string | null
  includesTime: boolean
  colourBy: string | null
  last: boolean
  onToggle: () => void
  onFromChange: (value: string) => void
  onToChange: (value: string | null) => void
  onIncludesTimeChange: (value: boolean) => void
  onColourByChange: (value: string | null) => void
}

export function TypeConfigRow({
  type,
  checked,
  from,
  to,
  includesTime,
  colourBy,
  last,
  onToggle,
  onFromChange,
  onToChange,
  onIncludesTimeChange,
  onColourByChange
}: TypeConfigRowProps): React.JSX.Element {
  const { t } = useTranslation()
  /** An empty value can never be a property key. */
  const none = { value: '', label: t('common.none') }
  const typeColour = { value: '', label: t('config.typeColour') }
  const selects = colourOptions(type)
  return (
    <div
      className={[
        'flex items-center gap-12 py-10',
        last ? '' : 'border-b border-line-hairline'
      ].join(' ')}
    >
      <Checkbox
        checked={checked}
        swatch={type.category}
        onChange={onToggle}
        ariaLabel={t('common.showTypeObjects', { label: type.label })}
      />
      <TypeTile type={type} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="type-ui text-small text-ink-primary">{type.label}</span>
      </div>
      <Select
        size="sm"
        className="w-152"
        ariaLabel={t('config.fromDateFor', { label: type.label })}
        options={dateOptions(type)}
        value={from}
        disabled={!checked}
        onChange={onFromChange}
      />
      <Select
        size="sm"
        className="w-152"
        ariaLabel={t('config.toDateFor', { label: type.label })}
        options={[none, ...dateOptions(type).filter((option) => option.value !== from)]}
        value={to ?? none.value}
        disabled={!checked}
        onChange={(value) => onToChange(value === none.value ? null : value)}
      />
      <div className="flex w-56 shrink-0 justify-center">
        <Checkbox
          checked={includesTime}
          onChange={onIncludesTimeChange}
          disabled={!checked}
          ariaLabel={t('config.typeIncludesTime', { label: type.label })}
        />
      </div>
      {/* Only v2 says what a select's options look like, so under v1 there is nothing to pick. */}
      <Select
        size="sm"
        className="w-116"
        ariaLabel={t('config.colourFor', { label: type.label })}
        options={[typeColour, ...selects]}
        value={colourBy ?? typeColour.value}
        disabled={!checked || selects.length === 0}
        onChange={(value) => onColourByChange(value === typeColour.value ? null : value)}
      />
    </div>
  )
}
