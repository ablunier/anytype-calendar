import { useMemo, useState } from 'react'
import type { DateMapping, ObjectType, TypePicks } from '@renderer/types'

export interface TypeSelection {
  spaceKeys: string[]
  typeKeys: string[]
  /** Types that are both selected and inside a selected space. */
  activeTypes: ObjectType[]
  objectCount: number
  /** The picks as they stand, e.g. to save them. */
  picks: TypePicks
  mappingFor: (type: ObjectType) => DateMapping
  toggleSpace: (key: string) => void
  toggleType: (key: string) => void
  setFrom: (key: string, value: string) => void
  setTo: (key: string, value: string | null) => void
}

const toggle = (keys: string[], key: string): string[] =>
  keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]

/**
 * Interaction state, not data — the types themselves arrive as an argument, so the screens
 * using this hook still take everything they render through props. `initial` is read once,
 * on mount. A type with no entry in `dates` uses its own `from`/`to`, which also covers
 * types that arrive after mount.
 */
export function useTypeSelection(types: ObjectType[], initial: TypePicks): TypeSelection {
  const [spaceKeys, setSpaceKeys] = useState(initial.spaceKeys)
  const [typeKeys, setTypeKeys] = useState(initial.typeKeys)
  const [dates, setDates] = useState(initial.dates)

  const activeTypes = useMemo(
    () => types.filter((type) => spaceKeys.includes(type.space) && typeKeys.includes(type.key)),
    [types, spaceKeys, typeKeys]
  )

  const mappingFor = (type: ObjectType): DateMapping =>
    dates[type.key] ?? { from: type.from, to: type.to }

  const update = (key: string, change: (mapping: DateMapping) => DateMapping): void => {
    const type = types.find((candidate) => candidate.key === key)
    if (!type) return
    setDates((current) => ({
      ...current,
      [key]: change(current[key] ?? { from: type.from, to: type.to })
    }))
  }

  return {
    spaceKeys,
    typeKeys,
    activeTypes,
    objectCount: activeTypes.reduce((total, type) => total + type.count, 0),
    picks: { spaceKeys, typeKeys, dates },
    mappingFor,
    toggleSpace: (key) => setSpaceKeys((keys) => toggle(keys, key)),
    toggleType: (key) => setTypeKeys((keys) => toggle(keys, key)),
    // A range from a date to itself is not a selection main accepts, so it becomes one date.
    setFrom: (key, value) =>
      update(key, ({ to }) => ({ from: value, to: to === value ? null : to })),
    setTo: (key, value) => update(key, ({ from }) => ({ from, to: value }))
  }
}
