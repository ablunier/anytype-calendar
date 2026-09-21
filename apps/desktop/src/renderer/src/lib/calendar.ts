/* Pure helpers over data the caller already holds. Calendar dates are local `YYYY-MM-DD`
 * strings, so they compare in order as strings.
 *
 * Recurrence is deliberately absent; overlap is resolved into lanes by `month-layout.ts`.
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
  const shift = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const length = Math.ceil((shift + daysInMonth) / 7) * 7
  return Array.from({ length }, (_, index) => {
    const date = new Date(year, month, 1 - shift + index)
    return {
      day: date.getDate(),
      date: isoDate(date.getFullYear(), date.getMonth(), date.getDate()),
      outside: date.getMonth() !== month
    }
  })
}

/**
 * The ISO 8601 week (Monday first, week 1 holds the year's first Thursday) of a `YYYY-MM-DD`
 * date. Worked out in UTC so a daylight-saving change never moves the day.
 */
export function isoWeekNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  const thursday = new Date(Date.UTC(year, month - 1, day))
  thursday.setUTCDate(thursday.getUTCDate() + 3 - ((thursday.getUTCDay() + 6) % 7))
  const dayMs = 24 * 60 * 60 * 1000
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1)
  return Math.ceil(((thursday.getTime() - yearStart) / dayMs + 1) / 7)
}

/** `date` is `YYYY-MM-DD`. A range matches every date from its start to its end. */
export function eventsOnDay(events: CalendarEvent[], date: string): CalendarEvent[] {
  return events.filter((event) => event.date <= date && date <= (event.until ?? event.date))
}

export function isoDate(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

/** `date` is `YYYY-MM-DD`. */
export function longDate(date: string): string {
  const [year, month = 1, day] = date.split('-').map(Number)
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`
}

/** `date` is `YYYY-MM-DD`. Weekday and month abbreviated, e.g. `Fri Sep 4`; no year. */
export function shortDate(date: string): string {
  const [year, month = 1, day] = date.split('-').map(Number)
  const weekday = WEEKDAYS[(new Date(year, month - 1, day).getDay() + 6) % 7]
  return `${weekday} ${MONTH_NAMES[month - 1].slice(0, 3)} ${day}`
}

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`
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

/** Each type with the dates in `dates` where it has an entry, and its own where it has none. */
export function withDates(types: ObjectType[], dates: Record<string, DateMapping>): ObjectType[] {
  return types.map((type) => {
    const mapping = dates[type.key]
    return mapping
      ? {
          ...type,
          from: mapping.from,
          to: mapping.to,
          includesTime: mapping.includesTime
        }
      : type
  })
}

export function dateOptions(type: ObjectType): { value: string; label: string }[] {
  return type.props.map(({ key, label }) => ({ value: key, label }))
}

export function spacesByKeys(spaces: Space[], keys: string[]): Space[] {
  return spaces.filter((space) => keys.includes(space.key))
}
