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
  IconName,
  ObjectType,
  Space,
  SyncView,
  TypePicks
} from '@renderer/types'

/** Anytype gives spaces no colour the calendar can use, so each takes one by position. */
const SPACE_HUES: CategoryHue[] = ['teal', 'ochre', 'plum', 'graphite', 'sage', 'clay', 'dusk', 'rose']

/** Anytype's ten icon colours, folded onto the calendar's eight hues. */
const TYPE_HUES: Record<string, CategoryHue> = {
  grey: 'graphite',
  yellow: 'ochre',
  orange: 'ochre',
  red: 'clay',
  pink: 'rose',
  purple: 'plum',
  blue: 'dusk',
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

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** The spaces of the last successful sync; empty until there is one. */
export function spacesFor(snapshot: SchemaSnapshot): Space[] {
  return syncedSpaces(snapshot).map((space, index) => ({
    key: space.id,
    name: space.name,
    category: SPACE_HUES[index % SPACE_HUES.length] ?? 'graphite',
    objects: space.datedObjectCount
  }))
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
      return { state: 'synced', detail: elapsedSince(snapshot.last.syncedAt, now), hasResult }
    case 'failed':
      return {
        state: 'error',
        detail: snapshot.failure === 'unauthorized' ? 'Key not accepted' : 'Is Anytype running?',
        hasResult
      }
  }
}

/** True once the user has finished or skipped onboarding, even with nothing picked. */
export function isOnboarded(selection: SchemaSelectionSnapshot): boolean {
  return selection.phase === 'saved'
}

/**
 * The saved selection as picks over `types`. A saved date the type no longer has is left
 * out, so the type falls back to its own dates rather than showing a choice it cannot offer.
 */
export function picksFor(selection: SchemaSelectionSnapshot, types: ObjectType[]): TypePicks {
  if (selection.phase === 'unset') return { spaceKeys: [], typeKeys: [], dates: {} }
  const byKey = new Map(types.map((type) => [type.key, type]))
  const dates: Record<string, DateMapping> = {}
  for (const choice of selection.selection.types) {
    const key = objectTypeKey(choice.spaceId, choice.typeKey)
    const type = byKey.get(key)
    if (type && hasDate(type, choice.from) && (choice.to === null || hasDate(type, choice.to))) {
      dates[key] = { from: choice.from, to: choice.to }
    }
  }
  return {
    spaceKeys: selection.selection.spaceIds,
    typeKeys: selection.selection.types.map((choice) => objectTypeKey(choice.spaceId, choice.typeKey)),
    dates
  }
}

/**
 * The picks over the synced spaces, as the selection to save. Choices in spaces this sync
 * did not see — another account's, or a space since left — are carried over from
 * `previous` untouched, so they are there again if the space comes back.
 */
export function schemaSelectionFor(
  snapshot: SchemaSnapshot,
  picks: TypePicks,
  previous: SchemaSelectionSnapshot
): SchemaSelection {
  const spaces = syncedSpaces(snapshot)
  const seen = new Set(spaces.map((space) => space.id))
  const kept: SchemaSelection =
    previous.phase === 'saved' ? previous.selection : { spaceIds: [], types: [] }

  const picked = spaces.flatMap((space) =>
    space.types.flatMap((type): SchemaTypeChoice[] => {
      const key = objectTypeKey(space.id, type.key)
      if (!picks.typeKeys.includes(key)) return []
      const { from, to } = picks.dates[key] ?? defaultMapping(type)
      return [{ spaceId: space.id, typeKey: type.key, from, to }]
    })
  )

  return {
    spaceIds: [
      ...kept.spaceIds.filter((id) => !seen.has(id)),
      ...spaces.filter((space) => picks.spaceKeys.includes(space.id)).map((space) => space.id)
    ],
    types: [...kept.types.filter((choice) => !seen.has(choice.spaceId)), ...picked]
  }
}

function syncedSpaces(snapshot: SchemaSnapshot): SchemaSpace[] {
  return snapshot.phase === 'idle' ? [] : (snapshot.last?.spaces ?? [])
}

function objectTypeKey(spaceId: string, typeKey: string): string {
  return `${spaceId}:${typeKey}`
}

function objectTypeFor(space: SchemaSpace, type: SchemaType): ObjectType {
  return {
    key: objectTypeKey(space.id, type.key),
    space: space.id,
    label: type.name,
    category: (type.icon && TYPE_HUES[type.icon.color]) ?? 'graphite',
    icon: (type.icon && TYPE_ICONS[type.icon.name]) ?? 'calendar',
    count: type.datedObjectCount,
    props: type.dateProperties.map(({ key, name }) => ({ key, label: name })),
    ...defaultMapping(type)
  }
}

/** A newly ticked type starts on its first date, as a single day. */
function defaultMapping(type: SchemaType): DateMapping {
  return { from: type.dateProperties[0]?.key ?? '', to: null }
}

function hasDate(type: ObjectType, key: string): boolean {
  return type.props.some((prop) => prop.key === key)
}

function elapsedSince(at: number, now: number): string {
  const elapsed = Math.max(0, now - at)
  if (elapsed < MINUTE_MS) return 'just now'
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} min ago`
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)} h ago`
  return `${Math.floor(elapsed / DAY_MS)} d ago`
}
