import { useMemo, useState } from 'react'
import type { ObjectType } from '@renderer/types'

/** `to: null` means a point, not a range. */
export interface DateMapping {
  from: string
  to: string | null
}

export interface TypeSelection {
  spaceKeys: string[]
  typeKeys: string[]
  dates: Record<string, DateMapping>
  /** Types that are both selected and inside a selected space. */
  activeTypes: ObjectType[]
  objectCount: number
  toggleSpace: (key: string) => void
  toggleType: (key: string) => void
  setFrom: (key: string, value: string) => void
  setTo: (key: string, value: string | null) => void
}

const toggle = (keys: string[], key: string): string[] =>
  keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]

/**
 * Interaction state, not data — the types themselves arrive as an argument, so the screens
 * using this hook still take everything they render through props.
 */
export function useTypeSelection(
  types: ObjectType[],
  initialTypeKeys: string[],
  initialSpaceKeys: string[]
): TypeSelection {
  const [spaceKeys, setSpaceKeys] = useState(initialSpaceKeys)
  const [typeKeys, setTypeKeys] = useState(initialTypeKeys)
  const [dates, setDates] = useState<Record<string, DateMapping>>(() =>
    Object.fromEntries(types.map((type) => [type.key, { from: type.from, to: type.to }]))
  )

  const activeTypes = useMemo(
    () => types.filter((type) => spaceKeys.includes(type.space) && typeKeys.includes(type.key)),
    [types, spaceKeys, typeKeys]
  )

  return {
    spaceKeys,
    typeKeys,
    dates,
    activeTypes,
    objectCount: activeTypes.reduce((total, type) => total + type.count, 0),
    toggleSpace: (key) => setSpaceKeys((keys) => toggle(keys, key)),
    toggleType: (key) => setTypeKeys((keys) => toggle(keys, key)),
    setFrom: (key, value) =>
      setDates((current) => ({ ...current, [key]: { ...current[key], from: value } })),
    setTo: (key, value) =>
      setDates((current) => ({ ...current, [key]: { ...current[key], to: value } }))
  }
}
