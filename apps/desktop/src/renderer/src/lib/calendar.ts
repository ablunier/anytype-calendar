/* Pure helpers over data the caller already holds. Nothing here imports the mock module,
 * so the same functions serve an IPC-fed source unchanged.
 *
 * Recurrence, timezones and overlap resolution are deliberately absent — that is domain
 * work for a later pass, and the fixture data is already shaped to avoid needing it.
 */

import type { CalendarEvent, DateMapping, MonthCell, ObjectType, Space } from '@renderer/types'

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

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

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

export function eventsOnDay(events: CalendarEvent[], day: number): CalendarEvent[] {
  return events.filter((event) =>
    event.until !== undefined ? day >= event.day && day <= event.until : event.day === day
  )
}

export function isoDate(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

export function longDate(year: number, month: number, day: number): string {
  return `${day} ${MONTH_NAMES[month]} ${year}`
}

export function indexBy<T extends { key: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.key, item]))
}

export function typesInSpace(types: ObjectType[], spaceKey: string): ObjectType[] {
  return types.filter((type) => type.space === spaceKey)
}

/** Falls back to the key for a property the type no longer has. */
export function dateLabel(type: ObjectType, key: string): string {
  return type.props.find((prop) => prop.key === key)?.label ?? key
}

/** False when the mapping names a date the type does not have, e.g. one a re-read took away. */
export function offersDates(type: ObjectType, { from, to }: DateMapping): boolean {
  const offers = (key: string): boolean => type.props.some((prop) => prop.key === key)
  return offers(from) && (to === null || offers(to))
}

export function dateOptions(type: ObjectType): { value: string; label: string }[] {
  return type.props.map(({ key, label }) => ({ value: key, label }))
}

export function spacesByKeys(spaces: Space[], keys: string[]): Space[] {
  return spaces.filter((space) => keys.includes(space.key))
}
