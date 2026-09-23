import type { EventsDay, EventsSpan, EventsSpanKind } from '@anytype-calendar/events/domain'

/**
 * The span a launch opens on: the view the user last chose, around today. Without it the first
 * load would read a month, which a week or day view would have to replace the moment the
 * window drew — two reads of Anytype for one screen.
 *
 * `weekStart` is the user's first day of the week, Monday 0 to Sunday 6.
 */
export function defaultEventsSpan(
  view: EventsSpanKind,
  today: EventsDay,
  weekStart: number
): EventsSpan {
  switch (view) {
    case 'month':
      return { kind: 'month', year: today.year, month: today.month }
    case 'day':
      return { kind: 'day', start: today }
    case 'week':
      return { kind: 'week', start: startOfWeek(today, weekStart) }
  }
}

/** Back to the most recent `weekStart` weekday, which may fall in the previous month. */
function startOfWeek({ year, month, day }: EventsDay, weekStart: number): EventsDay {
  const date = new Date(year, month, day)
  // `new Date` reads years 0 to 99 as 1900 to 1999.
  date.setFullYear(year, month, day)
  // getDay() is Sunday 0; the preference is Monday 0.
  const back = (date.getDay() + 6 - weekStart + 7) % 7
  // Counted in calendar days rather than milliseconds, so a week whose clocks change still
  // lands on midnight of the right day.
  const start = new Date(year, month, day - back)
  start.setFullYear(year, month, day - back)
  return { year: start.getFullYear(), month: start.getMonth(), day: start.getDate() }
}
