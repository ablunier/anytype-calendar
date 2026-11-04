import { SpaceMonogram } from '@renderer/components/app/SpaceMonogram'
import { Checkbox } from '@renderer/components/ui'
import { typesInSpace } from '@renderer/lib/calendar'
import type { ObjectType, Space } from '@renderer/types'
import { useTranslation } from 'react-i18next'

export interface SpacePickerProps {
  spaces: Space[]
  types: ObjectType[]
  selectedKeys: string[]
  onToggle: (key: string) => void
}

export function SpacePicker({ spaces, types, selectedKeys, onToggle }: SpacePickerProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div>
      <h2 className="type-overline text-tiny text-ink-tertiary">{t('onboarding.spacePicker.heading')}</h2>
      <ul className="mt-8 flex list-none flex-col gap-2 p-0">
        {spaces.map((space) => {
          const on = selectedKeys.includes(space.key)
          return (
            <li
              key={space.key}
              className={['flex h-row items-center gap-10 rounded-6 px-8', on ? 'bg-surface-selected' : ''].join(' ')}
            >
              {/* The name is the checkbox label, so clicking it toggles (#31). */}
              <div className="min-w-0 flex-1">
                <Checkbox
                  checked={on}
                  onChange={() => onToggle(space.key)}
                  leading={<SpaceMonogram space={space} />}
                  label={space.name}
                  labelClassName={on ? 'text-small text-ink-accent' : 'text-small text-ink-body'}
                />
              </div>
              <span className="type-numeral text-tiny text-ink-tertiary">{typesInSpace(types, space.key).length}</span>
            </li>
          )
        })}
      </ul>
      <p className="mt-12 type-caption text-tiny text-ink-tertiary">{t('onboarding.spacePicker.note')}</p>
    </div>
  )
}
