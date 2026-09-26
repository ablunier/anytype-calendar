/* The only renderer module that reads the shape of a schema snapshot or a selection
 * snapshot; components get view models. */

import type {
  SchemaSelection,
  SchemaSpace,
  SchemaType,
  SchemaTypeChoice
} from '@anytype-calendar/schema/domain'
import type { SchemaSelectionSnapshot, SchemaSnapshot } from '@shared/ipc'
import type {
  CategoryHue,
  DateMapping,
  Elapsed,
  IconName,
  ObjectType,
  Space,
  SyncView,
  TypePicks
} from '@renderer/types'
import { offeredMapping } from './calendar'

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

/** Whether the last successful sync found spaces the key was not granted; false until there is one. */
export function hasNotGrantedSpaces(snapshot: SchemaSnapshot): boolean {
  return snapshot.phase !== 'idle' && snapshot.last?.hasNotGrantedSpaces === true
}

/** Every dated type of the last successful sync, space by space; empty until there is one. */
export function typesFor(snapshot: SchemaSnapshot): ObjectType[] {
  return syncedSpaces(snapshot).flatMap((space) =>
    space.types.map((type) => objectTypeFor(space, type))
  )
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

/** Whether any chosen type is inside a chosen space, which is what main puts on the calendar. */
export function tracksAnyType(selection: SchemaSelectionSnapshot): boolean {
  if (selection.phase === 'unset') return false
  const { spaceIds, types } = selection.selection
  return types.some((choice) => spaceIds.includes(choice.spaceId))
}

/**
 * The saved selection as picks over `types`. A saved date the type no longer has is left
 * out, so the type falls back to its own dates rather than showing a choice it cannot offer;
 * so is a property it no longer colours by.
 */
export function picksFor(selection: SchemaSelectionSnapshot, types: ObjectType[]): TypePicks {
  if (selection.phase === 'unset') return { spaceKeys: [], typeKeys: [], dates: {} }
  const byKey = new Map(types.map((type) => [type.key, type]))
  const dates: Record<string, DateMapping> = {}
  for (const { spaceId, typeKey, from, to, includesTime, colourBy } of selection.selection.types) {
    const key = objectTypeKey(spaceId, typeKey)
    const type = byKey.get(key)
    const mapping = type && offeredMapping(type, { from, to, includesTime, colourBy })
    if (mapping) dates[key] = mapping
  }
  return {
    spaceKeys: selection.selection.spaceIds,
    typeKeys: selection.selection.types.map((choice) => objectTypeKey(choice.spaceId, choice.typeKey)),
    dates
  }
}

/**
 * The picks over the synced spaces and types, as the selection to save: only what the user
 * can see is rewritten. Choices this sync did not see — in another account's space, a space
 * since left, or a type since deleted or stripped of its dates — are carried over from
 * `previous` untouched, so they are there again if it comes back. A seen type whose picked
 * dates are gone is saved with its own, as it is drawn.
 */
export function schemaSelectionFor(
  snapshot: SchemaSnapshot,
  picks: TypePicks,
  previous: SchemaSelectionSnapshot
): SchemaSelection {
  const spaces = syncedSpaces(snapshot)
  const seenSpaces = new Set(spaces.map((space) => space.id))
  const seenTypes = new Set(
    spaces.flatMap((space) => space.types.map((type) => objectTypeKey(space.id, type.key)))
  )
  const kept: SchemaSelection =
    previous.phase === 'saved' ? previous.selection : { spaceIds: [], types: [] }

  const picked = spaces.flatMap((space) =>
    space.types.flatMap((schemaType): SchemaTypeChoice[] => {
      const type = objectTypeFor(space, schemaType)
      if (!picks.typeKeys.includes(type.key)) return []
      const mapping = picks.dates[type.key]
      const { from, to, includesTime, colourBy } = (mapping && offeredMapping(type, mapping)) ?? type
      return [{ spaceId: space.id, typeKey: schemaType.key, from, to, includesTime, colourBy }]
    })
  )

  return {
    spaceIds: [
      ...kept.spaceIds.filter((id) => !seenSpaces.has(id)),
      ...spaces.filter((space) => picks.spaceKeys.includes(space.id)).map((space) => space.id)
    ],
    types: [
      ...kept.types.filter((choice) => !seenTypes.has(objectTypeKey(choice.spaceId, choice.typeKey))),
      ...picked
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

function objectTypeFor(space: SchemaSpace, type: SchemaType): ObjectType {
  return {
    key: objectTypeKey(space.id, type.key),
    space: space.id,
    label: type.name,
    category: type.icon ? hueOf(type.icon.color) : 'graphite',
    icon: (type.icon && TYPE_ICONS[type.icon.name]) ?? 'calendar',
    props: type.dateProperties.map(({ key, name }) => ({ key, label: name })),
    selects: type.selectProperties.map(({ key, name }) => ({ key, label: name })),
    ...defaultMapping(type)
  }
}

/** A newly ticked type starts on its first date, as a single all-day date in its own hue. */
function defaultMapping(type: SchemaType): DateMapping {
  return { from: type.dateProperties[0]?.key ?? '', to: null, includesTime: false, colourBy: null }
}

/** Both epoch milliseconds. Untranslated: resolved to text by `syncDetailText` (`lib/sync-text.ts`). */
export function elapsedSince(at: number, now: number): Elapsed {
  const elapsed = Math.max(0, now - at)
  if (elapsed < MINUTE_MS) return { key: 'justNow' }
  if (elapsed < HOUR_MS) return { key: 'minutesAgo', count: Math.floor(elapsed / MINUTE_MS) }
  if (elapsed < DAY_MS) return { key: 'hoursAgo', count: Math.floor(elapsed / HOUR_MS) }
  return { key: 'daysAgo', count: Math.floor(elapsed / DAY_MS) }
}
