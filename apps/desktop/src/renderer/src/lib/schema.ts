/* The only renderer module that reads the shape of a schema snapshot or a selection
 * snapshot; components get view models. */

import {
  EMPTY_SCHEMA_SELECTION,
  SCHEMA_DONE_KEY,
  SCHEMA_LOCATION_KEY,
  type SchemaQuery,
  type SchemaQueryChoice,
  type SchemaSelection,
  type SchemaSpace,
  type SchemaType,
  type SchemaTypeChoice
} from '@anytype-calendar/schema/domain'
import type { SchemaSelectionSnapshot, SchemaSnapshot } from '@shared/ipc'
import type {
  CategoryHue,
  Collection,
  CollectionChoice,
  CollectionHint,
  CollectionPick,
  DateMapping,
  Elapsed,
  IconName,
  ObjectType,
  Space,
  SyncView,
  TypePicks
} from '@renderer/types'
import { mappingIn, offeredMapping } from './calendar'

/**
 * Anytype's ten colours — of type icons and select options alike — one hue each, so what
 * Anytype tells apart stays apart here.
 */
const TYPE_HUES: Record<string, CategoryHue> = {
  grey: 'graphite',
  yellow: 'mustard',
  orange: 'ochre',
  red: 'clay',
  pink: 'rose',
  purple: 'plum',
  blue: 'denim',
  ice: 'dusk',
  teal: 'teal',
  lime: 'sage'
}

/** Anytype names its type icons after Ionicons; these are the ones with a vendored match. */
const TYPE_ICONS: Record<string, IconName> = {
  checkbox: 'check',
  checkmark: 'check',
  'checkmark-circle': 'check',
  calendar: 'calendar',
  today: 'calendar-days',
  time: 'clock',
  alarm: 'clock',
  people: 'users',
  person: 'users',
  'person-circle': 'users',
  'id-card': 'users',
  book: 'file-text',
  document: 'file-text',
  'document-text': 'file-text',
  create: 'file-text',
  reader: 'file-text',
  receipt: 'file-text',
  hammer: 'layers',
  construct: 'layers',
  briefcase: 'layers',
  layers: 'layers',
  folder: 'layers',
  star: 'star',
  bulb: 'star',
  bookmark: 'tag',
  pricetag: 'tag',
  location: 'map-pin',
  link: 'link',
  globe: 'globe',
  earth: 'globe',
  notifications: 'bell',
  repeat: 'repeat',
  search: 'search',
  list: 'list'
}

/** The hue Anytype's colour name is drawn in; one Anytype does not name draws neutral. */
export function hueOf(color: string): CategoryHue {
  return (Object.hasOwn(TYPE_HUES, color) && TYPE_HUES[color]) || 'graphite'
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** The spaces of the last successful sync; empty until there is one. */
export function spacesFor(snapshot: SchemaSnapshot): Space[] {
  return syncedSpaces(snapshot).map((space) =>
    space.icon === undefined
      ? { key: space.id, name: space.name }
      : { key: space.id, name: space.name, icon: space.icon }
  )
}

/** By space key, the collections of the last successful sync; empty where there are none (v1). */
export function collectionsBySpaceFor(snapshot: SchemaSnapshot): Map<string, Collection[]> {
  return new Map(
    syncedSpaces(snapshot).map((space) => [
      space.id,
      space.collections.map(({ id, name, lastModified, backlinks }) => ({ key: id, name, lastModified, backlinks }))
    ])
  )
}

/** The most backlinks a collection's hint names before it counts the rest. */
const MAX_HINT_BACKLINKS = 2

/**
 * Sorted by name, those of one name most recently modified first, each with what tells it
 * apart from the others of its name: the objects linking to it that do not link to all of
 * them, or else when it was last modified.
 */
export function collectionChoices(collections: Collection[]): CollectionChoice[] {
  const byName = new Map<string, Collection[]>()
  for (const collection of collections) {
    byName.set(collection.name, [...(byName.get(collection.name) ?? []), collection])
  }
  return [...collections]
    .sort((a, b) => a.name.localeCompare(b.name) || (b.lastModified ?? -Infinity) - (a.lastModified ?? -Infinity))
    .map((collection) => ({ collection, hint: hintFor(collection, byName.get(collection.name) ?? []) }))
}

function hintFor(collection: Collection, namesakes: Collection[]): CollectionHint {
  if (namesakes.length < 2) return null
  const others = namesakes.filter((namesake) => namesake !== collection)
  const telling = [...new Set(collection.backlinks)].filter(
    (name) => !others.every((other) => other.backlinks.includes(name))
  )
  if (telling.length > 0) {
    return {
      kind: 'backlinks',
      names: telling.slice(0, MAX_HINT_BACKLINKS),
      more: Math.max(telling.length - MAX_HINT_BACKLINKS, 0)
    }
  }
  return collection.lastModified === null ? null : { kind: 'modified', at: collection.lastModified }
}

/**
 * None first, whatever is typed, then the collections whose name holds `query`, ignoring case
 * and accents. Backlinks are not searched: they only tell names apart.
 */
export function collectionPicksFor(choices: CollectionChoice[], query: string): CollectionPick[] {
  const wanted = foldForSearch(query.trim())
  return [
    { kind: 'none' },
    ...choices
      .filter(({ collection }) => foldForSearch(collection.name).includes(wanted))
      .map((choice): CollectionPick => ({ kind: 'collection', ...choice }))
  ]
}

/** So that `cafe` finds `Café`: decomposed, its combining marks dropped, lower-cased. */
export function foldForSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** Whether the last successful sync found spaces the key was not granted; false until there is one. */
export function hasNotGrantedSpaces(snapshot: SchemaSnapshot): boolean {
  return snapshot.phase !== 'idle' && snapshot.last?.hasNotGrantedSpaces === true
}

/**
 * Every dated type of the last successful sync, then the queries over them, space by space;
 * empty until there is one.
 */
export function typesFor(snapshot: SchemaSnapshot): ObjectType[] {
  return syncedSpaces(snapshot).flatMap((space) => [
    ...space.types.map((type) => objectTypeFor(space, type)),
    ...space.queries.flatMap((query) => {
      const type = space.types.find(({ key }) => key === query.typeKey)
      return type ? [queryTypeFor(space, query, type)] : []
    })
  ])
}

/** `now` is epoch milliseconds. */
export function syncViewFor(snapshot: SchemaSnapshot, now: number): SyncView {
  const hasResult = snapshot.phase !== 'idle' && snapshot.last !== undefined
  switch (snapshot.phase) {
    // Idle only until main starts the sync it runs on every sign-in.
    case 'idle':
    case 'syncing':
      return { state: 'syncing', hasResult }
    case 'synced':
      return {
        state: 'synced',
        detail: { kind: 'elapsed', elapsed: elapsedSince(snapshot.last.syncedAt, now) },
        hasResult
      }
    case 'failed':
      return {
        state: 'error',
        detail: { kind: snapshot.failure === 'unauthorized' ? 'unauthorized' : 'unreachable' },
        hasResult
      }
  }
}

/** True once the user has finished or skipped onboarding, even with nothing picked. */
export function isOnboarded(selection: SchemaSelectionSnapshot): boolean {
  return selection.phase === 'saved'
}

/**
 * Whether any chosen type or query is inside a chosen space, which is what main puts on the
 * calendar.
 */
export function tracksAnyType(selection: SchemaSelectionSnapshot): boolean {
  if (selection.phase === 'unset') return false
  const { spaceIds, types, queries } = selection.selection
  return [...types, ...queries].some((choice) => spaceIds.includes(choice.spaceId))
}

/**
 * The saved selection as picks over `types`. A saved date the type no longer has is left
 * out, so the type falls back to its own dates rather than showing a choice it cannot offer;
 * so is a property it no longer colours by, and a view a query no longer has.
 */
export function picksFor(selection: SchemaSelectionSnapshot, types: ObjectType[]): TypePicks {
  if (selection.phase === 'unset') return { spaceKeys: [], typeKeys: [], dates: {} }
  const byKey = new Map(types.map((type) => [type.key, type]))
  const chosen = [
    ...selection.selection.types.map(({ spaceId, typeKey, ...drawn }) => ({
      key: objectTypeKey(spaceId, typeKey),
      mapping: { ...drawn, view: null }
    })),
    ...selection.selection.queries.map(({ spaceId, queryId, viewId, ...drawn }) => ({
      key: querySourceKey(spaceId, queryId),
      mapping: { ...drawn, view: viewId }
    }))
  ]
  const dates: Record<string, DateMapping> = {}
  for (const { key, mapping } of chosen) {
    const type = byKey.get(key)
    const offered = type && offeredMapping(type, mapping)
    if (offered) dates[key] = offered
  }
  return {
    spaceKeys: selection.selection.spaceIds,
    typeKeys: chosen.map(({ key }) => key),
    dates
  }
}

/**
 * The picks over the synced spaces, types and queries, as the selection to save: only what
 * the user can see is rewritten. Choices this sync did not see — in another account's space,
 * a space since left, or a type or query since deleted or stripped of its dates — are carried
 * over from `previous` untouched, so they are there again if it comes back. A seen type or
 * query whose picked dates are gone is saved with its own, as it is drawn.
 */
export function schemaSelectionFor(
  snapshot: SchemaSnapshot,
  picks: TypePicks,
  previous: SchemaSelectionSnapshot
): SchemaSelection {
  const spaces = syncedSpaces(snapshot)
  const seenSpaces = new Set(spaces.map((space) => space.id))
  const offered = new Map(typesFor(snapshot).map((type) => [type.key, type]))
  const kept: SchemaSelection =
    previous.phase === 'saved' ? previous.selection : EMPTY_SCHEMA_SELECTION

  /** How a seen, ticked type or query is drawn; null for one not seen or not ticked. */
  const drawn = (key: string): DateMapping | null => {
    const type = offered.get(key)
    if (!type || !picks.typeKeys.includes(key)) return null
    return offeredMapping(type, mappingIn(picks.dates, type)) ?? mappingIn({}, type)
  }

  const types = spaces.flatMap((space) =>
    space.types.flatMap((type): SchemaTypeChoice[] => {
      const mapping = drawn(objectTypeKey(space.id, type.key))
      if (!mapping) return []
      const { view: _, ...choice } = mapping
      return [{ spaceId: space.id, typeKey: type.key, ...choice }]
    })
  )
  const queries = spaces.flatMap((space) =>
    space.queries.flatMap((query): SchemaQueryChoice[] => {
      const mapping = drawn(querySourceKey(space.id, query.id))
      if (!mapping) return []
      const { view, ...choice } = mapping
      return [{ spaceId: space.id, queryId: query.id, viewId: view, ...choice }]
    })
  )

  return {
    spaceIds: [
      ...kept.spaceIds.filter((id) => !seenSpaces.has(id)),
      ...spaces.filter((space) => picks.spaceKeys.includes(space.id)).map((space) => space.id)
    ],
    types: [
      ...kept.types.filter((choice) => !offered.has(objectTypeKey(choice.spaceId, choice.typeKey))),
      ...types
    ],
    queries: [
      ...kept.queries.filter((choice) => !offered.has(querySourceKey(choice.spaceId, choice.queryId))),
      ...queries
    ]
  }
}

function syncedSpaces(snapshot: SchemaSnapshot): SchemaSpace[] {
  return snapshot.phase === 'idle' ? [] : (snapshot.last?.spaces ?? [])
}

/** The key of the ObjectType for a type of a space. */
export function objectTypeKey(spaceId: string, typeKey: string): string {
  return `${spaceId}:${typeKey}`
}

/** The key Anytype knows a type by, from the ObjectType of one: the inverse of objectTypeKey. */
export function anytypeTypeKeyOf(type: ObjectType): string {
  return type.key.slice(type.space.length + 1)
}

/**
 * The types a new object can be created as: the chosen ones of chosen spaces. Not queries,
 * whose objects are those of a type, created as that type.
 */
export function creatableTypesFor(types: ObjectType[], picks: TypePicks): ObjectType[] {
  return types.filter(
    (type) =>
      type.query === undefined && picks.typeKeys.includes(type.key) && picks.spaceKeys.includes(type.space)
  )
}

/**
 * The key of the ObjectType for a query of a space. Neither a type key nor an object id holds
 * a colon, so it cannot be taken for a type's.
 */
export function querySourceKey(spaceId: string, queryId: string): string {
  return `${spaceId}:query:${queryId}`
}

function objectTypeFor(space: SchemaSpace, type: SchemaType): ObjectType {
  return {
    key: objectTypeKey(space.id, type.key),
    space: space.id,
    label: type.name,
    category: type.icon ? hueOf(type.icon.color) : 'graphite',
    icon: (type.icon && TYPE_ICONS[type.icon.name]) ?? 'calendar',
    props: type.dateProperties.map(({ key, name }) => ({ key, label: name })),
    selects: type.selectProperties.map(({ key, name }) => ({ key, label: name })),
    checkboxes: type.checkboxProperties.map(({ key, name }) => ({ key, label: name })),
    texts: type.textProperties.map(({ key, name }) => ({ key, label: name })),
    panelProps: type.panelProperties.map(({ key, name, format }) => ({ key, label: name, format })),
    ...defaultMapping(type)
  }
}

/** Drawn in its type's hue, since its objects are that type's; its icon says it is a query. */
function queryTypeFor(space: SchemaSpace, query: SchemaQuery, type: SchemaType): ObjectType {
  return {
    ...objectTypeFor(space, type),
    key: querySourceKey(space.id, query.id),
    label: query.name,
    icon: 'funnel',
    query: {
      typeKey: objectTypeKey(space.id, type.key),
      typeLabel: type.name,
      views: query.views.map(({ id, name }) => ({ key: id, label: name }))
    }
  }
}

/**
 * A newly ticked type starts on its first date, as a single all-day date in its own hue, ticked
 * done and placed by Anytype's own Done and Location where it has them, and showing nothing more.
 */
function defaultMapping(type: SchemaType): Omit<DateMapping, 'view'> {
  const has = (properties: readonly { key: string }[], key: string): boolean =>
    properties.some((property) => property.key === key)
  return {
    from: type.dateProperties[0]?.key ?? '',
    to: null,
    includesTime: false,
    colourBy: null,
    panel: [],
    done: has(type.checkboxProperties, SCHEMA_DONE_KEY) ? SCHEMA_DONE_KEY : null,
    location: has(type.textProperties, SCHEMA_LOCATION_KEY) ? SCHEMA_LOCATION_KEY : null
  }
}

/** Both epoch milliseconds. Untranslated: resolved to text by `syncDetailText` (`lib/sync-text.ts`). */
export function elapsedSince(at: number, now: number): Elapsed {
  const elapsed = Math.max(0, now - at)
  if (elapsed < MINUTE_MS) return { key: 'justNow' }
  if (elapsed < HOUR_MS) return { key: 'minutesAgo', count: Math.floor(elapsed / MINUTE_MS) }
  if (elapsed < DAY_MS) return { key: 'hoursAgo', count: Math.floor(elapsed / HOUR_MS) }
  return { key: 'daysAgo', count: Math.floor(elapsed / DAY_MS) }
}
