import { useTranslation } from 'react-i18next'
import type { ObjectType, Space } from '@renderer/types'
import { SpaceMonogram } from '@renderer/components/app/SpaceMonogram'
import { Icon } from '@renderer/components/ui'
import { typesInSpace } from '@renderer/lib/calendar'

export interface SpacePickerProps {
  spaces: Space[]
  types: ObjectType[]
  selectedKeys: string[]
  onToggle: (key: string) => void
}

export function SpacePicker({
  spaces,
  types,
  selectedKeys,
  onToggle
}: SpacePickerProps): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <div>
      <h2 className="type-overline text-tiny text-ink-tertiary">{t('onboarding.spacePicker.heading')}</h2>
      <ul className="mt-8 flex list-none flex-col gap-2 p-0">
        {spaces.map((space) => {
          const on = selectedKeys.includes(space.key)
          return (
            <li key={space.key}>
              {/* Whole-row target (name included), matching sidebar ToggleRow (#31). */}
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={t('common.showSpace', { name: space.name })}
                onClick={() => onToggle(space.key)}
                className={[
                  'flex h-row w-full items-center gap-10 rounded-6 border-0 px-8 text-left',
                  on ? 'bg-surface-selected' : 'bg-transparent'
                ].join(' ')}
              >
                <span
                  aria-hidden
                  className={[
                    'flex size-16 shrink-0 items-center justify-center rounded-4 border',
                    on ? 'border-transparent bg-surface-accent' : 'border-line-strong bg-surface-card'
                  ].join(' ')}
                >
                  {on ? <Icon name="check" size={11} className="text-stone-000" /> : null}
                </span>
                <SpaceMonogram space={space} />
                <span
                  className={[
                    'min-w-0 flex-1 truncate type-ui text-small',
                    on ? 'text-ink-accent' : 'text-ink-body'
                  ].join(' ')}
                >
                  {space.name}
                </span>
                <span className="type-numeral text-tiny text-ink-tertiary">
                  {typesInSpace(types, space.key).length}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-12 type-caption text-tiny text-ink-tertiary">
        {t('onboarding.spacePicker.note')}
      </p>
    </div>
  )
}
