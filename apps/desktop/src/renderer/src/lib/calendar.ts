/* Pure helpers over data the caller already holds. Calendar dates are local `YYYY-MM-DD`
 * strings, so they compare in order as strings.
 *
 * Recurrence is deliberately absent; overlap is resolved into lanes by `month-layout.ts`.
 */

import type { CalendarEvent, DateMapping, MonthCell, ObjectType, Space } from '@renderer/types'

const FIRST_WEEKEND_INDEX = 5

/** A Monday, used only to read weekday names off `Intl.DateTimeFormat` in order. */
const REFERENCE_MONDAY = Date.UTC(2024, 0, 1)

/**
 * Electron bundles Chromium's own ICU data, not Node's — and unlike `es`, Chromium's copy
 * carries no data for `gl` at all: every `Intl` call for it silently falls back to Chromium's
 * default locale instead of throwing (confirmed via `Intl.DateTimeFormat.supportedLocalesOf`,
 * which comes back empty for `gl`/`gl-ES`). This table is Galician's calendar vocabulary,
 * used only when `Intl` itself cannot supply it.
 */
const GALICIAN_CALENDAR = {
  months: [
    'xaneiro',
    'febreiro',
    'marzo',
    'abril',
    'maio',
    'xuño',
    'xullo',
    'agosto',
    'setembro',
    'outubro',
    'novembro',
    'decembro'
  ],
  monthsShort: [
    'xan.',
    'feb.',
    'mar.',
    'abr.',
    'maio',
    'xuño',
    'xul.',
    'ago.',
    'set.',
    'out.',
    'nov.',
    'dec.'
  ],
  weekdaysLong: ['luns', 'martes', 'mércores', 'xoves', 'venres', 'sábado', 'domingo'],
  weekdaysShort: ['luns', 'mar.', 'mér.', 'xov.', 'ven.', 'sáb.', 'dom.'],
  meridiem: { am: 'a.m.', pm: 'p.m.' }
}

const localeSupport = new Map<string, boolean>()

function supportsLocale(locale: string): boolean {
  let supported = localeSupport.get(locale)
  if (supported === undefined) {
    supported = Intl.DateTimeFormat.supportedLocalesOf([locale]).length > 0
    localeSupport.set(locale, supported)
  }
  return supported
}

function usesGalicianFallback(locale: string): boolean {
  return locale === 'gl' && !supportsLocale(locale)
}

/** Monday first, in `locale`'s own names — e.g. `style: 'long'` gives `WEEKDAY_NAMES`'s old role. */
export function weekdayNames(locale: string, style: 'short' | 'long'): string[] {
  if (usesGalicianFallback(locale)) {
    return style === 'long' ? GALICIAN_CALENDAR.weekdaysLong : GALICIAN_CALENDAR.weekdaysShort
  }
  const format = new Intl.DateTimeFormat(locale, { weekday: style, timeZone: 'UTC' })
  return Array.from({ length: 7 }, (_, day) =>
    format.format(new Date(REFERENCE_MONDAY + day * 86_400_000))
  )
}

/** The weekday (Monday is 0) shown in `column` of a week that starts on `weekStart`. */
function weekdayAt(weekStart: number, column: number): number {
  return (weekStart + column) % 7
}

export function weekdaysFrom(weekStart: number, locale: string): string[] {
  const names = weekdayNames(locale, 'short')
  return names.map((_, column) => names[weekdayAt(weekStart, column)])
}

export function isWeekendColumn(weekStart: number, column: number): boolean {
  return weekdayAt(weekStart, column) >= FIRST_WEEKEND_INDEX
}

/**
 * The 7-column grid for a month, padded with the adjacent months' days so the first row
 * starts on `weekStart` and the last row is full.
 */
export function buildMonthGrid(year: number, month: number, weekStart = 0): MonthCell[] {
  const shift = (new Date(year, month, 1).getDay() + 6 - weekStart) % 7
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
export function longDate(date: string, locale: string): string {
  const [year, month = 1, day] = date.split('-').map(Number)
  if (usesGalicianFallback(locale)) {
    return `${day} de ${GALICIAN_CALENDAR.months[month - 1]} de ${year}`
  }
  const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  return format.format(new Date(year, month - 1, day))
}

/** `date` is `YYYY-MM-DD`. Weekday and month abbreviated, e.g. `Fri, Sep 4`; no year. */
export function shortDate(date: string, locale: string): string {
  const [year, month = 1, day] = date.split('-').map(Number)
  if (usesGalicianFallback(locale)) {
    const weekday = GALICIAN_CALENDAR.weekdaysShort[(new Date(year, month - 1, day).getDay() + 6) % 7]
    return `${weekday}, ${day} de ${GALICIAN_CALENDAR.monthsShort[month - 1]}`
  }
  const format = new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' })
  return format.format(new Date(year, month - 1, day))
}

export function monthLabel(year: number, month: number, locale: string): string {
  if (usesGalicianFallback(locale)) return `${GALICIAN_CALENDAR.months[month]} de ${year}`
  const format = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
  return format.format(new Date(year, month, 1))
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

/** `HH:MM` in local time, drawn the way the user chose to read the clock. */
export function formatTime(time: string, format: '24h' | '12h', locale: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  if (format === '24h') return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  if (usesGalicianFallback(locale)) {
    const meridiem = hours < 12 ? GALICIAN_CALENDAR.meridiem.am : GALICIAN_CALENDAR.meridiem.pm
    return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${meridiem}`
  }
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC'
  })
  return formatter.format(new Date(Date.UTC(1970, 0, 1, hours, minutes)))
}
