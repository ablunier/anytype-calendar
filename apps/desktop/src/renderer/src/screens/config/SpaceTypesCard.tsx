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
        {!on ? (
          <span className="type-numeral text-tiny text-ink-tertiary">
            hidden · {types.length} types
          </span>
        ) : types.length > 0 ? (
          <>
            <span className="w-152 type-caption text-tiny text-ink-tertiary">From date</span>
            <span className="w-152 type-caption text-tiny text-ink-tertiary">
              To date (optional)
            </span>
          </>
        ) : null}
      </div>
      {on && types.length === 0 ? (
        <p className="pt-10 type-body text-small text-ink-tertiary">
          No type in this space has a date property yet.
        </p>
      ) : null}
      {on
        ? types.map((type, index) => (
            <TypeConfigRow
              key={type.key}
              type={type}
              checked={selection.typeKeys.includes(type.key)}
              from={selection.mappingFor(type).from}
              to={selection.mappingFor(type).to}
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
