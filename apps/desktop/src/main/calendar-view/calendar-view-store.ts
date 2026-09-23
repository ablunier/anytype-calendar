import type { EventsSpanKind } from '@anytype-calendar/events/domain'

/** The three views share their names with the spans they read, so there is one vocabulary. */
export type CalendarView = EventsSpanKind

export type CalendarViewListener = (view: CalendarView) => void

export const DEFAULT_CALENDAR_VIEW: CalendarView = 'month'

const VIEWS: CalendarView[] = ['month', 'week', 'day']

/** Null: not a saved calendar-view preference. */
export function toCalendarView(value: unknown): CalendarView | null {
  return VIEWS.includes(value as CalendarView) ? (value as CalendarView) : null
}

export class CalendarViewStore {
  #view = DEFAULT_CALENDAR_VIEW
  readonly #listeners = new Set<CalendarViewListener>()

  get(): CalendarView {
    return this.#view
  }

  /** Setting the current value again notifies no one. */
  set(view: CalendarView): void {
    if (view === this.#view) return
    this.#view = view
    for (const listener of this.#listeners) listener(view)
  }

  subscribe(listener: CalendarViewListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}
