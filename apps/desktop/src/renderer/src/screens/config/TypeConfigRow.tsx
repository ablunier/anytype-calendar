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
  /* The columns of SpaceTypesCard's header, so every row's controls line up under it. A query's
   * view goes on a line of its own under its name, leaving the first line a type row's. */
  return (
    <div
      className={[
        'grid grid-cols-[auto_auto_minmax(0,1fr)_var(--spacing-152)_var(--spacing-152)_var(--spacing-56)_var(--spacing-116)] items-center gap-x-12 gap-y-8 py-10',
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
      <div className="flex min-w-0 flex-col">
        <span className="type-ui text-small text-ink-primary">{type.label}</span>
        {type.query ? (
          <span className="type-caption text-tiny text-ink-tertiary">
            {t('common.queryOf', { type: type.query.typeLabel })}
          </span>
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
      <div className="flex justify-center">
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
      {type.query ? (
        // Until one is picked, Anytype reads the first.
        <Select
          size="sm"
          className="col-start-3"
          ariaLabel={t('config.viewFor', { label: type.label })}
          options={viewOptions(type)}
          value={view ?? type.query.views[0]?.key ?? ''}
          disabled={!checked}
          onChange={onViewChange}
        />
      ) : null}
    </div>
  )
}
