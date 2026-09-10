/* Pure helpers over data the caller already holds. Nothing here imports the mock module,
 * so the same functions serve an IPC-fed source unchanged.
 *
 * Recurrence, timezones and overlap resolution are deliberately absent — that is domain
 * work for a later pass, and the fixture data is already shaped to avoid needing it.
 */

import type { CalendarEvent, MonthCell, ObjectType, Space } from '../types'

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

/** Monday-first weekday headers. */
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Index in WEEKDAYS at which the weekend starts. */
export const FIRST_WEEKEND_INDEX = 5

/**
 * The 7-column grid for a month, padded with the adjacent months' days so the first row
 * starts on a Monday and the last row is full.
 */
export function buildMonthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1)
  const shift = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev = new Date(year, month, 0).getDate()
  const cells: MonthCell[] = []

  for (let i = shift; i > 0; i--) cells.push({ day: daysInPrev - i + 1, outside: true })
  for (let day = 1; day <= daysInMonth; day++) cells.push({ day, outside: false })

  let trailing = 1
  while (cells.length % 7 !== 0) cells.push({ day: trailing++, outside: true })
  return cells
}

/** Events touching a given day — a ranged event covers every day from `day` to `until`. */
export function eventsOnDay(events: CalendarEvent[], day: number): CalendarEvent[] {
  return events.filter((event) =>
    event.until !== undefined ? day >= event.day && day <= event.until : event.day === day
  )
}

/** ISO date for a day-of-month within the fixture month. Used for <time datetime>. */
export function isoDate(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

/** Prose date — "12 Mar 2026" — for reading contexts rather than dense UI. */
export function longDate(year: number, month: number, day: number): string {
  return `${day} ${MONTH_NAMES[month]} ${year}`
}

export function indexBy<T extends { key: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.key, item]))
}

/** Types belonging to one space, in declaration order. */
export function typesInSpace(types: ObjectType[], spaceKey: string): ObjectType[] {
  return types.filter((type) => type.space === spaceKey)
}

export function spacesByKeys(spaces: Space[], keys: string[]): Space[] {
  return spaces.filter((space) => keys.includes(space.key))
}
