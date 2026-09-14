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
 * `from`, and no type chosen twice. Spaces listed twice are collapsed.
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
  const { spaceId, typeKey, from, to, includesTime } = value as Record<string, unknown>
  if (!isId(spaceId) || !isId(typeKey) || !isId(from)) return null
  if (to !== null && (!isId(to) || to === from)) return null
  if (typeof includesTime !== 'boolean') return null
  return { spaceId, typeKey, from, to, includesTime }
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}
