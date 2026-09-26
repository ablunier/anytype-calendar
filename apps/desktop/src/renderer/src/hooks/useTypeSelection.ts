import { useMemo, useState } from 'react'
import type { DateMapping, ObjectType, TypePicks } from '@renderer/types'
import { indexBy, offeredMapping } from '@renderer/lib/calendar'

export interface TypeSelection {
  spaceKeys: string[]
  typeKeys: string[]
  /** Types that are both selected and inside a selected space. */
  activeTypes: ObjectType[]
  /** The picks as they stand, e.g. to save them. The same object until a pick changes. */
  picks: TypePicks
  mappingFor: (type: ObjectType) => DateMapping
  toggleSpace: (key: string) => void
  toggleType: (key: string) => void
  setFrom: (key: string, value: string) => void
  setTo: (key: string, value: string | null) => void
  setIncludesTime: (key: string, value: boolean) => void
  setColourBy: (key: string, value: string | null) => void
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
   * coming back later does not revive a choice that is no longer the saved one. A property the
   * entry colours by is forgotten the same way, keeping its dates. Adjusted during render, as
   * App does, so no frame draws the stale entry. */
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
    picks,
    mappingFor: (type) => mappingIn(dates, type),
    toggleSpace: (key) =>
      setPicks((current) => ({ ...current, spaceKeys: toggle(current.spaceKeys, key) })),
    toggleType: (key) =>
      setPicks((current) => ({ ...current, typeKeys: toggle(current.typeKeys, key) })),
    // A range from a date to itself is not a selection main accepts, so it becomes one date.
    setFrom: (key, value) =>
      update(key, (mapping) => ({ ...mapping, from: value, to: mapping.to === value ? null : mapping.to })),
    setTo: (key, value) => update(key, (mapping) => ({ ...mapping, to: value })),
    setIncludesTime: (key, value) => update(key, (mapping) => ({ ...mapping, includesTime: value })),
    setColourBy: (key, value) => update(key, (mapping) => ({ ...mapping, colourBy: value }))
  }
}

function mappingIn(dates: TypePicks['dates'], type: ObjectType): DateMapping {
  return (
    dates[type.key] ?? {
      from: type.from,
      to: type.to,
      includesTime: type.includesTime,
      colourBy: type.colourBy
    }
  )
}

/**
 * The same object when nothing changes, so an unchanged read is not a change. Entries of types
 * missing from `types` are kept, for when the type comes back.
 */
function withOfferedDates(picks: TypePicks, types: ObjectType[]): TypePicks {
  const byKey = indexBy(types)
  let changed = false
  const offered = Object.entries(picks.dates).flatMap(([key, mapping]): [string, DateMapping][] => {
    const type = byKey.get(key)
    const kept = type === undefined ? mapping : offeredMapping(type, mapping)
    if (kept !== mapping) changed = true
    return kept === null ? [] : [[key, kept]]
  })
  return changed ? { ...picks, dates: Object.fromEntries(offered) } : picks
}
