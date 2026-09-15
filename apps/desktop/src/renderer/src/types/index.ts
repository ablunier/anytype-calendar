/* UI-local types for the renderer.
 *
 * These are deliberately defined here and not in a package's domain layer: the shapes
 * describe what a component needs to draw, not what the calendar means. The lib/ modules map
 * the snapshots main pushes onto them, so they are the view-model boundary.
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
  /** Date properties only. */
  props: DateProperty[]
  /** Key of the mandatory start-date property the type starts with. */
  from: string
  /** Key of the optional end-date property; a type with one is drawn as a range. */
  to: string | null
  /** Whether From/To carry a time of day, as the user states it; starts false (all-day). */
  includesTime: boolean
}

/** `to: null` means a point, not a range. `from`/`to` are property keys. */
export interface DateMapping {
  from: string
  to: string | null
  includesTime: boolean
}

/** What the user has ticked, keyed by `Space.key` and `ObjectType.key`. */
export interface TypePicks {
  spaceKeys: string[]
  typeKeys: string[]
  /** Only types whose dates differ from their own `from`/`to` need an entry. */
  dates: Record<string, DateMapping>
}

export interface CalendarMonth {
  year: number
  /** Zero-based, matching Date. */
  month: number
}

/** Dates are local `YYYY-MM-DD` and times local `HH:MM`, so dates compare as strings. */
export interface CalendarEvent {
  /** Anytype's object id, the same on every read. */
  id: string
  title: string
  /** Key of the owning ObjectType. */
  type: string
  /** Key of the owning Space. */
  space: string
  date: string
  /** Absent for an all-day event. */
  time?: string
  /** The date a range ends on, which may be `date` itself; absent for a single date. */
  until?: string
  /** The time a timed range ends at. */
  end?: string
  allDay: boolean
  done?: boolean
}

export interface MonthCell {
  day: number
  /** In the month the day belongs to, which for an outside cell is an adjacent one. */
  date: string
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
  | { kind: 'event'; event: CalendarEvent }
  /** `date` is `YYYY-MM-DD`. */
  | { kind: 'day'; date: string }

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
