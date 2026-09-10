/* UI-local types for the renderer.
 *
 * These are deliberately defined here and not in packages/domain. This pass is a
 * presentational one: the shapes describe what a component needs to draw, not what the
 * calendar means. When the real use cases land behind IPC they will bring their own
 * domain types, and these become the view-model boundary they map onto.
 */

/** The eight muted category hues. Decorative only — never the sole carrier of meaning. */
export type CategoryHue =
  | 'sage'
  | 'clay'
  | 'ochre'
  | 'dusk'
  | 'plum'
  | 'teal'
  | 'rose'
  | 'graphite'

/** An Anytype space the account can see. */
export interface Space {
  key: string
  name: string
  category: CategoryHue
  /** Count of dated objects in the space. */
  objects: number
}

/** One object type within one space, and the date properties it exposes. */
export interface ObjectType {
  key: string
  space: string
  label: string
  category: CategoryHue
  icon: IconName
  /** Count of dated objects of this type. */
  count: number
  /** Every date property the type carries. */
  props: string[]
  /** The mandatory start-date property. */
  from: string
  /** The optional end-date property; a type with one is drawn as a range. */
  to: string | null
}

/** A dated object placed on the grid. Days are day-of-month within the mock month. */
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

/** Everything the UI reads. Swapped for an IPC-fed equivalent in a later pass. */
export interface CalendarData {
  spaces: Space[]
  types: ObjectType[]
  events: CalendarEvent[]
  year: number
  /** Zero-based, matching Date. */
  month: number
  monthLabel: string
  today: number
  /** Type keys currently tracked. */
  trackedTypeKeys: string[]
  /** Space keys currently tracked. */
  trackedSpaceKeys: string[]
}

/** One square of the month grid before events are attached. */
export interface MonthCell {
  day: number
  /** True for the leading and trailing days borrowed from adjacent months. */
  outside: boolean
}

/** The screens in the flow. Navigation is local state — there is no router. */
export type ScreenId = 'auth' | 'onboarding' | 'config' | 'month'

/** The five states of the auth screen. */
export type AuthStage = 'start' | 'code' | 'verifying' | 'error' | 'success'

/** What the month view's detail panel is showing. */
export type DetailTarget =
  | { kind: 'object'; event: CalendarEvent }
  | { kind: 'day'; day: number }

/** Names of the vendored Lucide glyphs. Keeps Icon's `name` prop honest. */
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
