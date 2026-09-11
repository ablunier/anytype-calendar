import { useMemo, useState } from 'react'
import type { DateMapping, ObjectType, TypePicks } from '@renderer/types'
import { indexBy, offersDates } from '@renderer/lib/calendar'

export interface TypeSelection {
  spaceKeys: string[]
  typeKeys: string[]
  /** Types that are both selected and inside a selected space. */
  activeTypes: ObjectType[]
  objectCount: number
  /** The picks as they stand, e.g. to save them. The same object until a pick changes. */
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
  const [picks, setPicks] = useState(() => withOfferedDates(initial, types))
  const { spaceKeys, typeKeys, dates } = picks

  /* A re-read can take away a date a type's entry names. The entry is dropped, not just
   * hidden, so the type is drawn — and saved — with its own dates from then on, and the date
   * coming back later does not revive a choice that is no longer the saved one. Adjusted
   * during render, as App does, so no frame draws the stale entry. */
  const [typesSeen, setTypesSeen] = useState(types)
  if (types !== typesSeen) {
    setTypesSeen(types)
    setPicks((current) => withOfferedDates(current, types))
  }

  const activeTypes = useMemo(
    () => types.filter((type) => spaceKeys.includes(type.space) && typeKeys.includes(type.key)),
    [types, spaceKeys, typeKeys]
  )

  const update = (key: string, change: (mapping: DateMapping) => DateMapping): void => {
    const type = types.find((candidate) => candidate.key === key)
    if (!type) return
    setPicks((current) => ({
      ...current,
      dates: { ...current.dates, [key]: change(mappingIn(current.dates, type)) }
    }))
  }

  return {
    spaceKeys,
    typeKeys,
    activeTypes,
    objectCount: activeTypes.reduce((total, type) => total + type.count, 0),
    picks,
    mappingFor: (type) => mappingIn(dates, type),
    toggleSpace: (key) =>
      setPicks((current) => ({ ...current, spaceKeys: toggle(current.spaceKeys, key) })),
    toggleType: (key) =>
      setPicks((current) => ({ ...current, typeKeys: toggle(current.typeKeys, key) })),
    // A range from a date to itself is not a selection main accepts, so it becomes one date.
    setFrom: (key, value) =>
      update(key, ({ to }) => ({ from: value, to: to === value ? null : to })),
    setTo: (key, value) => update(key, ({ from }) => ({ from, to: value }))
  }
}

function mappingIn(dates: TypePicks['dates'], type: ObjectType): DateMapping {
  return dates[type.key] ?? { from: type.from, to: type.to }
}

/**
 * The same object when nothing is dropped, so an unchanged read is not a change. Entries of
 * types missing from `types` are kept, for when the type comes back.
 */
function withOfferedDates(picks: TypePicks, types: ObjectType[]): TypePicks {
  const byKey = indexBy(types)
  const entries = Object.entries(picks.dates)
  const offered = entries.filter(([key, mapping]) => {
    const type = byKey.get(key)
    return type === undefined || offersDates(type, mapping)
  })
  return offered.length === entries.length
    ? picks
    : { ...picks, dates: Object.fromEntries(offered) }
}
