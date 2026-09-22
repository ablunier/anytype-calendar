import { useTranslation } from 'react-i18next'
import type { ObjectType, Space } from '@renderer/types'
import { SpaceMonogram } from '@renderer/components/app/SpaceMonogram'
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
  const { t } = useTranslation()
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
          ariaLabel={t('common.showSpace', { name: space.name })}
        />
        <SpaceMonogram space={space} />
        <h3 className="type-ui text-base text-ink-primary">{space.name}</h3>
        <div className="flex-1" />
        {!on ? (
          <span className="type-numeral text-tiny text-ink-tertiary">
            {t('config.hiddenTypesCount', { count: types.length })}
          </span>
        ) : types.length > 0 ? (
          <>
            <span className="w-152 type-caption text-tiny text-ink-tertiary">
              {t('common.fromDate')}
            </span>
            <span className="w-152 type-caption text-tiny text-ink-tertiary">
              {t('common.toDateOptional')}
            </span>
            <span className="w-56 shrink-0 text-center type-caption text-tiny text-ink-tertiary">
              {t('config.time')}
            </span>
          </>
        ) : null}
      </div>
      {on && types.length === 0 ? (
        <p className="pt-10 type-body text-small text-ink-tertiary">{t('common.noDatedType')}</p>
      ) : null}
      {on
        ? types.map((type, index) => (
            <TypeConfigRow
              key={type.key}
              type={type}
              checked={selection.typeKeys.includes(type.key)}
              from={selection.mappingFor(type).from}
              to={selection.mappingFor(type).to}
              includesTime={selection.mappingFor(type).includesTime}
              last={index === types.length - 1}
              onToggle={() => selection.toggleType(type.key)}
              onFromChange={(value) => selection.setFrom(type.key, value)}
              onToChange={(value) => selection.setTo(type.key, value)}
              onIncludesTimeChange={(value) => selection.setIncludesTime(type.key, value)}
            />
          ))
        : null}
    </Card>
  )
}
