import type { ObjectType } from '../../types'
import { TypeTile } from '../../components/app/TypeTile'
import { Checkbox, Select } from '../../components/ui'

export interface TypeConfigRowProps {
  type: ObjectType
  checked: boolean
  from: string
  to: string | null
  last: boolean
  onToggle: () => void
  onFromChange: (value: string) => void
  onToChange: (value: string | null) => void
}

const NONE = 'None'

/** One dense settings row: the type, and the two date properties it maps onto. */
export function TypeConfigRow({
  type,
  checked,
  from,
  to,
  last,
  onToggle,
  onFromChange,
  onToChange
}: TypeConfigRowProps): React.JSX.Element {
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
        ariaLabel={`Show ${type.label} objects on the calendar`}
      />
      <TypeTile type={type} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="type-ui text-small text-ink-primary">{type.label}</span>
        <span className="type-numeral text-tiny text-ink-tertiary">
          {type.count} dated objects
        </span>
      </div>
      <Select
        size="sm"
        className="w-152"
        ariaLabel={`From date for ${type.label}`}
        options={type.props}
        value={from}
        disabled={!checked}
        onChange={onFromChange}
      />
      <Select
        size="sm"
        className="w-152"
        ariaLabel={`To date for ${type.label}`}
        options={[NONE, ...type.props]}
        value={to ?? NONE}
        disabled={!checked}
        onChange={(value) => onToChange(value === NONE ? null : value)}
      />
    </div>
  )
}
