import type { ObjectType, Space } from '@renderer/types'
import { SpaceDot } from '@renderer/components/app/SpaceDot'
import { Card, Checkbox } from '@renderer/components/ui'
import type { TypeSelection } from '@renderer/hooks/useTypeSelection'
import { TypeConfigRow } from './TypeConfigRow'

export interface SpaceTypesCardProps {
  space: Space
  types: ObjectType[]
  selection: TypeSelection
}

export function SpaceTypesCard({
  space,
  types,
  selection
}: SpaceTypesCardProps): React.JSX.Element {
  const on = selection.spaceKeys.includes(space.key)
  return (
    <Card className={on ? '' : 'opacity-72'}>
      <div
        className={[
          'flex items-center gap-10',
          on ? 'border-b border-line-hairline pb-8' : ''
        ].join(' ')}
      >
        <Checkbox
          checked={on}
          onChange={() => selection.toggleSpace(space.key)}
          ariaLabel={`Show the ${space.name} space`}
        />
        <SpaceDot space={space} />
        <h3 className="type-ui text-base text-ink-primary">{space.name}</h3>
        <div className="flex-1" />
        {on ? (
          <>
            <span className="w-152 type-caption text-tiny text-ink-tertiary">From date</span>
            <span className="w-152 type-caption text-tiny text-ink-tertiary">
              To date (optional)
            </span>
          </>
        ) : (
          <span className="type-numeral text-tiny text-ink-tertiary">
            hidden · {types.length} types
          </span>
        )}
      </div>
      {on
        ? types.map((type, index) => (
            <TypeConfigRow
              key={type.key}
              type={type}
              checked={selection.typeKeys.includes(type.key)}
              from={selection.dates[type.key].from}
              to={selection.dates[type.key].to}
              last={index === types.length - 1}
              onToggle={() => selection.toggleType(type.key)}
              onFromChange={(value) => selection.setFrom(type.key, value)}
              onToChange={(value) => selection.setTo(type.key, value)}
            />
          ))
        : null}
    </Card>
  )
}
