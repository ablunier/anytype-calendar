import { SCHEMA_DONE_KEY, SCHEMA_LOCATION_KEY } from './select-property'
import type { SchemaSpace } from './space'

/** A type put on the calendar, with the date properties (keys) its objects are drawn by. */
export interface SchemaTypeSource {
  spaceId: string
  typeKey: string
  from: string
  /** Null draws each object on one date; a key draws it as a range. */
  to: string | null
  /**
   * Whether From/To carry a time of day. The local API never says, since a date set with no
   * time is stored the same way as midnight (see the events context's placement model), so
   * the user states it instead.
   */
  includesTime: boolean
  /**
   * A select property (key) whose options colour the type's objects, each in its option's
   * colour; null draws them all in the type's own. An object with no option picked keeps the
   * type's colour too.
   */
  colourBy: string | null
  /** Properties (keys) the detail panel shows below the dates, in this order. */
  panel: string[]
  /** A checkbox property (key) its objects are ticked done by; null for none. */
  done: string | null
  /** A text property (key) that says where its objects take place; null for none. */
  location: string | null
}

/**
 * A query put on the calendar, read through one of its views. Its dates and colour-by
 * property are its type's, chosen as for a type (see SchemaTypeSource).
 */
export interface SchemaQuerySource {
  spaceId: string
  queryId: string
  /** Null reads the query's first view, whichever that is at the time. */
  viewId: string | null
  from: string
  to: string | null
  includesTime: boolean
  colourBy: string | null
  panel: string[]
  done: string | null
  location: string | null
}

/**
 * Keyed by Anytype ids only, so a Source whose space, type, query or property is gone from
 * the account is kept rather than dropped: it is simply matched by nothing until it returns.
 * A type or query chosen inside an unchosen space is kept too, for when the space is chosen
 * again.
 */
export interface SchemaSelection {
  spaceIds: string[]
  types: SchemaTypeSource[]
  queries: SchemaQuerySource[]
}

export const EMPTY_SCHEMA_SELECTION: SchemaSelection = { spaceIds: [], types: [], queries: [] }

/** `unset` until the user first finishes or skips onboarding; an empty selection is `saved`. */
export type SchemaSelectionState = { phase: 'unset' } | { phase: 'saved'; selection: SchemaSelection }

/**
 * Null unless `value` is a well-formed selection: non-empty ids, a `to` that differs from
 * `from`, and no type or query chosen twice. Spaces, and panel properties, listed twice are
 * collapsed. What a selection saved before it existed lacks reads as what it drew then: a
 * Source with no `colourBy` colours by nothing, one with no `panel` shows nothing more, one with
 * no `done` or `location` uses Anytype's own Done and Location, and a selection with no
 * `queries` chooses none.
 */
export function toSchemaSelection(value: unknown): SchemaSelection | null {
  if (typeof value !== 'object' || value === null) return null
  const { spaceIds, types, queries = [] } = value as Record<string, unknown>
  if (!Array.isArray(spaceIds) || !spaceIds.every(isId)) return null
  const typeSources = toSources(types, toTypeSource, (source) => source.typeKey)
  const querySources = toSources(queries, toQuerySource, (source) => source.queryId)
  if (!typeSources || !querySources) return null
  return { spaceIds: [...new Set(spaceIds)], types: typeSources, queries: querySources }
}

/** Null when any item is not a Source, or two name the same thing in the same space. */
function toSources<T extends { spaceId: string }>(
  items: unknown,
  toSource: (item: unknown) => T | null,
  idOf: (source: T) => string,
): T[] | null {
  if (!Array.isArray(items)) return null
  const sources: T[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const source = toSource(item)
    if (!source) return null
    // Space ids, type keys and object ids never contain a newline, so the pair cannot collide.
    const pair = `${source.spaceId}\n${idOf(source)}`
    if (seen.has(pair)) return null
    seen.add(pair)
    sources.push(source)
  }
  return sources
}

function toTypeSource(value: unknown): SchemaTypeSource | null {
  if (typeof value !== 'object' || value === null) return null
  const { spaceId, typeKey } = value as Record<string, unknown>
  const drawn = toDrawing(value)
  if (!isId(spaceId) || !isId(typeKey) || !drawn) return null
  return { spaceId, typeKey, ...drawn }
}

function toQuerySource(value: unknown): SchemaQuerySource | null {
  if (typeof value !== 'object' || value === null) return null
  const { spaceId, queryId, viewId } = value as Record<string, unknown>
  const drawn = toDrawing(value)
  if (!isId(spaceId) || !isId(queryId) || !drawn) return null
  if (viewId !== null && !isId(viewId)) return null
  return { spaceId, queryId, viewId, ...drawn }
}

/** How a Source's objects are drawn: the fields type and query Sources share. */
function toDrawing(value: object): Omit<SchemaTypeSource, 'spaceId' | 'typeKey'> | null {
  const {
    from,
    to,
    includesTime,
    colourBy = null,
    panel = [],
    done = SCHEMA_DONE_KEY,
    location = SCHEMA_LOCATION_KEY,
  } = value as Record<string, unknown>
  if (!isId(from)) return null
  if (to !== null && (!isId(to) || to === from)) return null
  if (typeof includesTime !== 'boolean') return null
  if (!isIdOrNull(colourBy) || !isIdOrNull(done) || !isIdOrNull(location)) return null
  if (!Array.isArray(panel) || !panel.every(isId)) return null
  return { from, to, includesTime, colourBy, panel: [...new Set(panel)], done, location }
}

function isIdOrNull(value: unknown): value is string | null {
  return value === null || isId(value)
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

/**
 * A selection saved while the app read through v1 of Anytype's API names a type the way v1
 * spelled it. v2 spells some differently — a user's type whose v1 key collides with one Anytype
 * bundles is served by its internal key (`6a67…`), and refused by the old one as ambiguous — so
 * each such Source is rewritten to the key the account now serves. Returns `selection` itself
 * when nothing needed rewriting.
 *
 * A Source whose type is already chosen under its current key is dropped: it is the same type.
 * Its properties are left alone: their v1 keys were known only to v1, so one that no longer
 * resolves falls back as any stale property does. Query Sources are left alone too: only v2
 * serves queries, so they were chosen by v2's keys.
 */
export function rekeySchemaSelection(selection: SchemaSelection, spaces: readonly SchemaSpace[]): SchemaSelection {
  const typesBySpace = new Map(spaces.map(({ id, types }) => [id, types]))
  const chosen = new Set(selection.types.map(({ spaceId, typeKey }) => `${spaceId}\n${typeKey}`))

  let changed = false
  const types = selection.types.flatMap((source) => {
    const candidates = typesBySpace.get(source.spaceId) ?? []
    if (candidates.some(({ key }) => key === source.typeKey)) return [source]
    const type = candidates.find(({ formerKey }) => formerKey === source.typeKey)
    if (!type) return [source]
    changed = true
    return chosen.has(`${source.spaceId}\n${type.key}`) ? [] : [{ ...source, typeKey: type.key }]
  })
  return changed ? { ...selection, types } : selection
}
