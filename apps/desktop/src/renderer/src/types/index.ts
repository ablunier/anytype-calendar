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
  /** A `data:` URL of the space's own image; absent when it has none. */
  icon?: string
}

export interface DateProperty {
  key: string
  label: string
}

/** A select property whose options can colour a type's objects. */
export interface SelectProperty {
  key: string
  label: string
}

/** A property offered by name, e.g. as the Done checkbox or the Location text. */
export interface NamedProperty {
  key: string
  label: string
}

/** How the detail panel draws a property's value. */
export type PanelFormat =
  | 'text'
  | 'number'
  | 'select'
  | 'multi_select'
  | 'url'
  | 'email'
  | 'phone'
  | 'objects'

/** A property the detail panel can show of a type's objects. */
export interface PanelProperty {
  key: string
  label: string
  format: PanelFormat
}

/** One of a query's views, which narrow its objects each in its own way. */
export interface QueryView {
  key: string
  label: string
}

/**
 * What makes an ObjectType a query: its objects are those of the type it runs over, read
 * through one of its views, and drawn by that type's dates.
 */
export interface QuerySource {
  /** The `ObjectType.key` of the type it runs over. */
  typeKey: string
  /** The label of the type it runs over. */
  typeLabel: string
  /** Never empty; the first is read until another is chosen. */
  views: QueryView[]
}

/**
 * What can be put on the calendar: a type, or a query over one (`query` set), which is drawn
 * in its type's hue. Scoped to a single space: the same Anytype type in two spaces is two
 * entries.
 */
export interface ObjectType {
  key: string
  space: string
  label: string
  category: CategoryHue
  icon: IconName
  /** Set for a query. */
  query?: QuerySource
  /** Date properties only. */
  props: DateProperty[]
  /** Empty where the API cannot say what the options' colours are (v1). */
  selects: SelectProperty[]
  checkboxes: NamedProperty[]
  texts: NamedProperty[]
  panelProps: PanelProperty[]
  /** Key of the mandatory start-date property the type starts with. */
  from: string
  /** Key of the optional end-date property; a type with one is drawn as a range. */
  to: string | null
  /** Whether From/To carry a time of day, as the user states it; starts false (all-day). */
  includesTime: boolean
  /** Key of the select property whose options colour its objects; starts null (the type's own hue). */
  colourBy: string | null
  /** Keys of the properties the detail panel shows, in order; starts empty. */
  panel: string[]
  /** Key of the checkbox its objects are ticked done by; starts on Anytype's own, where it has it. */
  done: string | null
  /** Key of the text that says where its objects take place; starts on Anytype's own, where it has it. */
  location: string | null
}

/**
 * How a type is drawn. `to: null` means a point, not a range. `from`/`to`/`colourBy` are
 * property keys.
 */
export interface DateMapping {
  from: string
  to: string | null
  includesTime: boolean
  colourBy: string | null
  panel: string[]
  done: string | null
  location: string | null
  /**
   * A query's view (`QueryView.key`) to read through; null for a type, and for a query until
   * one is picked, which reads its first.
   */
  view: string | null
}

/** What the user has ticked, keyed by `Space.key` and `ObjectType.key`. */
export interface TypePicks {
  spaceKeys: string[]
  /** Queries' too, since each is an ObjectType. */
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
  /** Key of the ObjectType it was read through: its type, or a query. */
  type: string
  /** Key of the owning Space. */
  space: string
  /**
   * Where the source it was read through stands in the selection, types first. An object two
   * sources bring is two events, and only the one of the lowest-ranked visible source is drawn.
   */
  rank: number
  date: string
  /** Absent for an all-day event. */
  time?: string
  /** The date a range ends on, which may be `date` itself; absent for a single date. */
  until?: string
  /** The time a timed range ends at. */
  end?: string
  allDay: boolean
  done?: boolean
  location?: string
  /**
   * The hue of its option in the property its type is coloured by, drawn instead of the
   * type's; for a feed's event, its subscription's.
   */
  category?: CategoryHue
  /** In the order its type's panel shows them. */
  details: EventDetail[]
  /** Set for an event of a subscribed calendar, which is read-only. */
  feed?: FeedEventDetails
}

/** What a subscribed calendar's event carries besides its dates. */
export interface FeedEventDetails {
  /** The subscription's name. */
  calendar: string
  /** Plain text. */
  description?: string
  /** A web page the feed links the event to. */
  url?: string
}

/** An external calendar subscribed to by its iCalendar address. */
export interface FeedSource {
  /** `feedSourceKey`, what its events carry as `CalendarEvent.type`. */
  key: string
  /** The subscription's own id, which main is asked by. */
  id: string
  name: string
  category: CategoryHue
  /** Anytype's name of `category`, which main stores. */
  colour: string
  /** Its address is a credential main keeps; only the host is shown. */
  host: string
  status: FeedStatus
}

/** Why a feed could not be read, or added. */
export type FeedFailure =
  | { failure: 'unreachable' }
  | { failure: 'http'; status: number }
  | { failure: 'not-calendar' }
  | { failure: 'invalid-url' }
  | { failure: 'invalid-name' }

/** How the last read of a feed went. Its events are those of the last good read, whatever the latest. */
export interface FeedStatus {
  state: SyncState
  /** Since the last good read; absent before any. */
  elapsed?: Elapsed
  /** Why the latest read failed. */
  failure?: FeedFailure
}

/**
 * One property the detail panel shows, keyed by the property, whose label its type says. Never
 * empty. A link's `href` is one main opens: `http(s)`, `mailto:` or `tel:`.
 */
export type EventDetail =
  | { key: string; kind: 'text'; text: string }
  | { key: string; kind: 'number'; value: number }
  | { key: string; kind: 'link'; text: string; href: string }
  | { key: string; kind: 'options'; options: { name: string; category: CategoryHue }[] }
  /** A member is shown by name, not opened: Anytype has no object to open for one. */
  | { key: string; kind: 'objects'; objects: { id: string; name: string; member: boolean }[] }

/** One calendar day of whatever the view draws: a cell of the month grid, a day column. */
export interface DayColumn {
  /** In the month the day belongs to, which for an outside cell is an adjacent one. */
  date: string
  /** True for the leading and trailing days borrowed from adjacent months. */
  outside: boolean
}

export interface MonthCell extends DayColumn {
  day: number
}

/** Which of the three the calendar is drawing. Named for the spans they read. */
export type CalendarView = 'month' | 'week' | 'day'

/**
 * Chosen locally once the session is connected; until then the auth session in main decides
 * what is on screen. `success` is the one-off "connected" card shown right after signing in.
 */
export type ConnectedScreen = 'success' | 'onboarding' | 'config' | 'calendar'

export type AuthFailureKind = 'invalid-code' | 'expired' | 'unreachable' | 'invalid-key'

export type AuthView =
  | { stage: 'start' }
  /** `expiresAt` is epoch milliseconds. */
  | { stage: 'code'; challengeId: string; expiresAt: number }
  | { stage: 'verifying'; code: string }
  /** Pasting a key the user already holds, instead of the code exchange. */
  | { stage: 'entering-key' }
  | { stage: 'verifying-key' }
  /**
   * `code` is absent when no challenge could be opened, or the failure came from the key
   * path; `origin` decides where "back"/"retry" return to.
   */
  | { stage: 'error'; failure: AuthFailureKind; code?: string; origin: 'code' | 'key' }
  | { stage: 'success' }

export type AuthStage = AuthView['stage']

export type SyncState = 'synced' | 'syncing' | 'offline' | 'error'

/** How long ago a sync/load landed, in the largest unit that still reads naturally. */
export type Elapsed =
  | { key: 'justNow' }
  | { key: 'minutesAgo'; count: number }
  | { key: 'hoursAgo'; count: number }
  | { key: 'daysAgo'; count: number }

/** Untranslated: a component resolves this to text with `syncDetailText` (`lib/sync-text.ts`). */
export type SyncDetail =
  | { kind: 'elapsed'; elapsed: Elapsed }
  | { kind: 'unauthorized' }
  | { kind: 'unreachable' }

/** How the last read of the account went, ready for SyncStatus. */
export interface SyncView {
  state: SyncState
  detail?: SyncDetail
  /** Whether any read has succeeded yet, so there is something to draw. */
  hasResult: boolean
}

/** Enough to recognise the key by; the renderer never holds the key itself. */
export interface ApiKeyView {
  hint: string
  /** Epoch milliseconds. */
  issuedAt: number
}

/**
 * What the connected key reaches. v1 cannot tell, so it says only which API is read through;
 * under v2 a key with no grant of its own reaches every space and may edit.
 */
export type ApiAccessView =
  | { version: 'v1' }
  | {
      version: 'v2'
      /** Null: every space, including ones created later. */
      spaceCount: number | null
      canEdit: boolean
    }

/**
 * Whether the calendar can edit objects: `editable`, or why not — the key was granted read
 * only, Anytype serves only v1, or Anytype has not yet been asked what the key may do.
 */
export type EditAccess = 'editable' | 'read-only' | 'needs-v2' | 'checking'

/** A day, `YYYY-MM-DD`, and for a time grid the minute of it from midnight. */
export interface CalendarSlot {
  date: string
  minute: number | null
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
  | 'key-round'
  | 'layers'
  | 'link'
  | 'list'
  | 'loader-circle'
  | 'map-pin'
  | 'minus'
  | 'moon'
  | 'panel-left-close'
  | 'panel-left-open'
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
