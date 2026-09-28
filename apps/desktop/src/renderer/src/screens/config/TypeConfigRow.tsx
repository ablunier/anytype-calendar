import { useTranslation } from 'react-i18next'
import type { ObjectType } from '@renderer/types'
import { TypeTile } from '@renderer/components/app/TypeTile'
import { Checkbox, Select, Tooltip } from '@renderer/components/ui'
import { colourOptions, dateOptions, viewOptions } from '@renderer/lib/calendar'

export interface TypeConfigRowProps {
  type: ObjectType
  checked: boolean
  from: string
  to: string | null
  includesTime: boolean
  colourBy: string | null
  /** A query's view; null for its first. Unused for a type. */
  view: string | null
  last: boolean
  onToggle: () => void
  onFromChange: (value: string) => void
  onToChange: (value: string | null) => void
  onIncludesTimeChange: (value: boolean) => void
  onColourByChange: (value: string | null) => void
  onViewChange: (value: string) => void
}

export function TypeConfigRow({
  type,
  checked,
  from,
  to,
  includesTime,
  colourBy,
  view,
  last,
  onToggle,
  onFromChange,
  onToChange,
  onIncludesTimeChange,
  onColourByChange,
  onViewChange
}: TypeConfigRowProps): React.JSX.Element {
  const { t } = useTranslation()
  /** An empty value can never be a property key. */
  const none = { value: '', label: t('common.none') }
  const typeColour = { value: '', label: t('config.typeColour') }
  const selects = colourOptions(type)
  const colourSelect = (
    <Select
      size="sm"
      className="w-116"
      ariaLabel={t('config.colourFor', { label: type.label })}
      options={[typeColour, ...selects]}
      value={colourBy ?? typeColour.value}
      disabled={!checked || selects.length === 0}
      onChange={(value) => onColourByChange(value === typeColour.value ? null : value)}
    />
  )
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
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <span className="type-ui text-small text-ink-primary">{type.label}</span>
        {type.query ? (
          <>
            <span className="type-caption text-tiny text-ink-tertiary">
              {t('common.queryOf', { type: type.query.typeLabel })}
            </span>
            {/* Until one is picked, Anytype reads the first. */}
            <Select
              size="sm"
              ariaLabel={t('config.viewFor', { label: type.label })}
              options={viewOptions(type)}
              value={view ?? type.query.views[0]?.key ?? ''}
              disabled={!checked}
              onChange={onViewChange}
            />
          </>
        ) : null}
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
      {selects.length === 0 ? (
        <Tooltip label={t('config.noColourProperty')} align="end">
          {colourSelect}
        </Tooltip>
      ) : (
        colourSelect
      )}
    </div>
  )
}
