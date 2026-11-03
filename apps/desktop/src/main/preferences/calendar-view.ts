import type { EventsSpanKind } from '@anytype-calendar/events/domain'

/** The three views share their names with the spans they read, so there is one vocabulary. */
export type CalendarView = EventsSpanKind

export const DEFAULT_CALENDAR_VIEW: CalendarView = 'month'

const VIEWS: CalendarView[] = ['month', 'week', 'day']

export function toCalendarView(value: unknown): CalendarView | undefined {
  return VIEWS.includes(value as CalendarView) ? (value as CalendarView) : undefined
}
