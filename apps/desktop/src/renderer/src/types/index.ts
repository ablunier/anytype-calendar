/* UI-local types for the renderer.
 *
 * These are deliberately defined here and not in a package's domain layer. This pass is a
 * presentational one: the shapes describe what a component needs to draw, not what the
 * calendar means. When the real use cases land behind IPC they will bring their own
 * domain types, and these become the view-model boundary they map onto.
 */

/** Decorative only — never the sole carrier of meaning. Types have one; spaces do not. */
export type CategoryHue =
  | 'sage'
  | 'clay'
  | 'ochre'
  | 'mustard'
  | 'dusk'
  | 'denim'
  | 'plum'
  | 'teal'
  | 'rose'
  | 'graphite'

export interface Space {
  key: string
  name: string
  /** Counts only objects carrying a date. */
  objects: number
}

export interface DateProperty {
  key: string
  label: string
}

/** Scoped to a single space: the same Anytype type in two spaces is two entries. */
export interface ObjectType {
  key: string
  space: string
  label: string
  category: CategoryHue
  icon: IconName
  /** Counts only objects carrying a date. */
  count: number
  /** Date properties only. */
  props: DateProperty[]
  /** Key of the mandatory start-date property the type starts with. */
  from: string
  /** Key of the optional end-date property; a type with one is drawn as a range. */
  to: string | null
}

/** `to: null` means a point, not a range. Both are property keys. */
export interface DateMapping {
  from: string
  to: string | null
}

/** What the user has ticked, keyed by `Space.key` and `ObjectType.key`. */
export interface TypePicks {
  spaceKeys: string[]
  typeKeys: string[]
  /** Only types whose dates differ from their own `from`/`to` need an entry. */
  dates: Record<string, DateMapping>
}

/** `day` and `until` are days of the month within the mock month. */
export interface CalendarEvent {
  id: number
  day: number
  title: string
  /** Key of the owning ObjectType. */
  type: string
  time?: string
  end?: string
  allDay?: boolean
  /** Last day of a range; absent for single-day objects. */
  until?: number
  done?: boolean
}

export interface CalendarData {
  spaces: Space[]
  types: ObjectType[]
  events: CalendarEvent[]
  year: number
  /** Zero-based, matching Date. */
  month: number
  monthLabel: string
  today: number
  trackedTypeKeys: string[]
  trackedSpaceKeys: string[]
}

export interface MonthCell {
  day: number
  /** True for the leading and trailing days borrowed from adjacent months. */
  outside: boolean
}

/**
 * Chosen locally once the session is connected; until then the auth session in main decides
 * what is on screen. `success` is the one-off "connected" card shown right after signing in.
 */
export type ConnectedScreen = 'success' | 'onboarding' | 'config' | 'month'

export type AuthFailureKind = 'invalid-code' | 'expired' | 'unreachable'

export type AuthView =
  | { stage: 'start' }
  /** `expiresAt` is epoch milliseconds. */
  | { stage: 'code'; challengeId: string; expiresAt: number }
  | { stage: 'verifying'; code: string }
  /** `code` is absent when no challenge could be opened. */
  | { stage: 'error'; failure: AuthFailureKind; code?: string }
  | { stage: 'success' }

export type AuthStage = AuthView['stage']

export type SyncState = 'synced' | 'syncing' | 'offline' | 'error'

/** How the last read of the account went, ready for SyncStatus. */
export interface SyncView {
  state: SyncState
  /** e.g. "just now", "Is Anytype running?". */
  detail?: string
  /** Whether any read has succeeded yet, so there is something to draw. */
  hasResult: boolean
}

/** Enough to recognise the key by; the renderer never holds the key itself. */
export interface ApiKeyView {
  hint: string
  /** Epoch milliseconds. */
  issuedAt: number
}

export type DetailTarget =
  | { kind: 'object'; event: CalendarEvent }
  | { kind: 'day'; day: number }

/** The Lucide glyphs vendored in assets/icons. Keeps Icon's `name` prop honest. */
export type IconName =
  | 'arrow-up-right'
  | 'bell'
  | 'calendar'
  | 'calendar-check'
  | 'calendar-clock'
  | 'calendar-days'
  | 'calendar-plus'
  | 'check'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'circle-alert'
  | 'circle-dot'
  | 'clock'
  | 'columns-3'
  | 'copy'
  | 'database'
  | 'ellipsis'
  | 'external-link'
  | 'eye'
  | 'eye-off'
  | 'file-text'
  | 'funnel'
  | 'globe'
  | 'inbox'
  | 'info'
  | 'layers'
  | 'link'
  | 'list'
  | 'loader-circle'
  | 'map-pin'
  | 'moon'
  | 'panel-left-close'
  | 'pencil'
  | 'plus'
  | 'refresh-cw'
  | 'repeat'
  | 'search'
  | 'settings'
  | 'shield-check'
  | 'sliders-horizontal'
  | 'star'
  | 'sun'
  | 'tag'
  | 'trash'
  | 'unplug'
  | 'users'
  | 'x'
