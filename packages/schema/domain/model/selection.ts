import type { SchemaSpace } from './space'

/** A type put on the calendar, with the date properties (keys) its objects are drawn by. */
export interface SchemaTypeChoice {
  spaceId: string
  typeKey: string
  from: string
  /** Null draws each object on one date; a key draws it as a range. */
  to: string | null
  /**
   * Whether From/To carry a time of day. The local API never says, since a date set with no
   * time is stored the same way as midnight (see the events context's dated-object model), so
   * the user states it instead.
   */
  includesTime: boolean
  /**
   * A select property (key) whose options colour the type's objects, each in its option's
   * colour; null draws them all in the type's own. An object with no option picked keeps the
   * type's colour too.
   */
  colourBy: string | null
}

/**
 * Keyed by Anytype ids only, so a choice whose space, type or property is gone from the
 * account is kept rather than dropped: it is simply matched by nothing until it returns.
 * A type chosen inside an unchosen space is kept too, for when the space is chosen again.
 */
export interface SchemaSelection {
  spaceIds: string[]
  types: SchemaTypeChoice[]
}

export const EMPTY_SCHEMA_SELECTION: SchemaSelection = { spaceIds: [], types: [] }

/** `unset` until the user first finishes or skips onboarding; an empty selection is `saved`. */
export type SchemaSelectionState =
  | { phase: 'unset' }
  | { phase: 'saved'; selection: SchemaSelection }

/**
 * Null unless `value` is a well-formed selection: non-empty ids, a `to` that differs from
 * `from`, and no type chosen twice. Spaces listed twice are collapsed. A choice with no
 * `colourBy` at all, as saved before there was one, colours by nothing.
 */
export function toSchemaSelection(value: unknown): SchemaSelection | null {
  if (typeof value !== 'object' || value === null) return null
  const { spaceIds, types } = value as Record<string, unknown>
  if (!Array.isArray(spaceIds) || !spaceIds.every(isId)) return null
  if (!Array.isArray(types)) return null

  const choices: SchemaTypeChoice[] = []
  const seen = new Set<string>()
  for (const item of types) {
    const choice = toChoice(item)
    if (!choice) return null
    // Space ids and type keys never contain a newline, so the pair cannot collide.
    const pair = `${choice.spaceId}\n${choice.typeKey}`
    if (seen.has(pair)) return null
    seen.add(pair)
    choices.push(choice)
  }
  return { spaceIds: [...new Set(spaceIds)], types: choices }
}

function toChoice(value: unknown): SchemaTypeChoice | null {
  if (typeof value !== 'object' || value === null) return null
  const { spaceId, typeKey, from, to, includesTime, colourBy = null } = value as Record<string, unknown>
  if (!isId(spaceId) || !isId(typeKey) || !isId(from)) return null
  if (to !== null && (!isId(to) || to === from)) return null
  if (typeof includesTime !== 'boolean') return null
  if (colourBy !== null && !isId(colourBy)) return null
  return { spaceId, typeKey, from, to, includesTime, colourBy }
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

/**
 * A selection saved while Anytype served only v1 of its API names a type or date property the
 * way v1 spelled it. v2 spells some differently — a user's type or property whose v1 key
 * collides with one Anytype bundles is served by its internal key (`6a67…`), and refused by
 * the old one as ambiguous — so each such choice is rewritten to the key the account now
 * serves. Returns `selection` itself when nothing needed rewriting.
 *
 * A choice whose type is already chosen under its current key is dropped: it is the same type.
 */
export function rekeySchemaSelection(
  selection: SchemaSelection,
  spaces: readonly SchemaSpace[]
): SchemaSelection {
  const typesBySpace = new Map(spaces.map(({ id, types }) => [id, types]))
  const chosen = new Set(selection.types.map(({ spaceId, typeKey }) => `${spaceId}\n${typeKey}`))

  let changed = false
  const types = selection.types.flatMap((choice) => {
    const candidates = typesBySpace.get(choice.spaceId) ?? []
    const type =
      candidates.find(({ key }) => key === choice.typeKey) ??
      candidates.find(({ formerKey }) => formerKey === choice.typeKey)
    if (!type) return [choice]

    const rekeyed: SchemaTypeChoice = {
      ...choice,
      typeKey: type.key,
      from: currentKey(type.dateProperties, choice.from),
      to: choice.to === null ? null : currentKey(type.dateProperties, choice.to),
      colourBy: choice.colourBy === null ? null : currentKey(type.selectProperties, choice.colourBy)
    }
    if (rekeyed.typeKey !== choice.typeKey && chosen.has(`${choice.spaceId}\n${rekeyed.typeKey}`)) {
      changed = true
      return []
    }
    if (
      rekeyed.typeKey === choice.typeKey &&
      rekeyed.from === choice.from &&
      rekeyed.to === choice.to &&
      rekeyed.colourBy === choice.colourBy
    ) {
      return [choice]
    }
    changed = true
    return [rekeyed]
  })
  return changed ? { ...selection, types } : selection
}

function currentKey(
  properties: readonly { key: string; formerKey?: string }[],
  key: string
): string {
  if (properties.some((property) => property.key === key)) return key
  return properties.find(({ formerKey }) => formerKey === key)?.key ?? key
}
