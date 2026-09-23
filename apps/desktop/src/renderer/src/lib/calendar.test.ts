import { describe, expect, test } from 'vitest'
import type { CalendarEvent, ObjectType, Space } from '@renderer/types'
import {
  addDays,
  formatTime,
  buildMonthGrid,
  buildWeek,
  dateLabel,
  dayLabel,
  dateOptions,
  eventsOnDay,
  indexBy,
  isoDate,
  isoWeekNumber,
  isWeekendColumn,
  longDate,
  monthLabel,
  offersDates,
  shortDate,
  spacesByKeys,
  typesInSpace,
  weekdayNames,
  weekdaysFrom,
  weekLabel,
  withDates
} from './calendar'

const TASK: ObjectType = {
  key: 'sp_1:task',
  space: 'sp_1',
  label: 'Task',
  category: 'denim',
  icon: 'calendar',
  props: [
    { key: 'due_date', label: 'Due date' },
    { key: 'start_date', label: 'Start date' }
  ],
  from: 'due_date',
  to: null,
  includesTime: false
}

describe('buildMonthGrid', () => {
  test('pads a month that starts after Monday with the previous month', () => {
    // February 2024: 1 Feb is a Thursday, so the grid borrows Mon-Wed from January.
    const grid = buildMonthGrid(2024, 1)
    expect(grid.slice(0, 3)).toEqual([
      { day: 29, date: '2024-01-29', outside: true },
      { day: 30, date: '2024-01-30', outside: true },
      { day: 31, date: '2024-01-31', outside: true }
    ])
    expect(grid[3]).toEqual({ day: 1, date: '2024-02-01', outside: false })
    expect(grid.at(-1)).toEqual({ day: 3, date: '2024-03-03', outside: true })
    expect(grid).toHaveLength(35)
  })

  test('starts on Monday with no leading days, and pads a full last row', () => {
    // September 2025: 1 Sep is a Monday; 30 days leaves the grid 2 short of a full row.
    const grid = buildMonthGrid(2025, 8)
    expect(grid[0]).toEqual({ day: 1, date: '2025-09-01', outside: false })
    expect(grid.slice(30).map(({ day, outside }) => ({ day, outside }))).toEqual([
      { day: 1, outside: true },
      { day: 2, outside: true },
      { day: 3, outside: true },
      { day: 4, outside: true },
      { day: 5, outside: true }
    ])
    expect(grid).toHaveLength(35)
  })

  test('dates the borrowed days across a year change', () => {
    // December 2026 starts on a Tuesday and ends on a Thursday.
    const grid = buildMonthGrid(2026, 11)
    expect(grid[0]).toEqual({ day: 30, date: '2026-11-30', outside: true })
    expect(grid.at(-1)).toEqual({ day: 3, date: '2027-01-03', outside: true })
  })

  test('grows to six rows when the month needs them', () => {
    // August 2026 starts on a Saturday and has 31 days.
    expect(buildMonthGrid(2026, 7)).toHaveLength(42)
  })

  test('every row is 7 long', () => {
    const grid = buildMonthGrid(2024, 1)
    expect(grid.length % 7).toBe(0)
  })
})

describe('buildMonthGrid with another week start', () => {
  test('starts the first row on a Sunday', () => {
    // February 2024: 1 Feb is a Thursday, so a Sunday-first grid borrows Sun-Wed from January.
    const grid = buildMonthGrid(2024, 1, 6)
    expect(grid[0]).toEqual({ day: 28, date: '2024-01-28', outside: true })
    expect(grid[4]).toEqual({ day: 1, date: '2024-02-01', outside: false })
    expect(grid).toHaveLength(35)
  })

  test('adds no padding when the month starts on the week start', () => {
    // 1 Feb 2024 is a Thursday.
    expect(buildMonthGrid(2024, 1, 3)[0].date).toBe('2024-02-01')
  })
})

describe('weekdayNames', () => {
  test('gives Monday-first names in the requested style and locale', () => {
    expect(weekdayNames('en', 'short')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(weekdayNames('en', 'long')).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday'
    ])
    expect(weekdayNames('es', 'long')[0]).toBe('lunes')
    expect(weekdayNames('gl', 'long')[0]).toBe('luns')
  })
})

describe('weekdaysFrom and isWeekendColumn', () => {
  test('rotates the weekdays to start on the given day', () => {
    expect(weekdaysFrom(0, 'en')).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(weekdaysFrom(6, 'en')).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
  })

  test('marks Saturday and Sunday wherever they fall', () => {
    expect([0, 1, 2, 3, 4, 5, 6].filter((c) => isWeekendColumn(6, c))).toEqual([0, 6])
    expect([0, 1, 2, 3, 4, 5, 6].filter((c) => isWeekendColumn(0, c))).toEqual([5, 6])
  })
})

describe('eventsOnDay', () => {
  const base = { title: '', type: TASK.key, space: 'sp_1', allDay: true }
  const single: CalendarEvent = { ...base, id: '1', date: '2026-09-05' }
  const range: CalendarEvent = {
    ...base,
    id: '2',
    date: '2026-09-05',
    until: '2026-09-08'
  }
  const intoOctober: CalendarEvent = {
    ...base,
    id: '3',
    date: '2026-09-29',
    until: '2026-10-02'
  }

  test('matches a single-day event only on its day', () => {
    expect(eventsOnDay([single], '2026-09-05')).toEqual([single])
    expect(eventsOnDay([single], '2026-09-06')).toEqual([])
  })

  test('matches a ranged event across its whole span', () => {
    expect(eventsOnDay([range], '2026-09-05')).toEqual([range])
    expect(eventsOnDay([range], '2026-09-07')).toEqual([range])
    expect(eventsOnDay([range], '2026-09-08')).toEqual([range])
    expect(eventsOnDay([range], '2026-09-04')).toEqual([])
    expect(eventsOnDay([range], '2026-09-09')).toEqual([])
  })

  test('matches a range on both sides of a month edge', () => {
    expect(eventsOnDay([intoOctober], '2026-09-30')).toEqual([intoOctober])
    expect(eventsOnDay([intoOctober], '2026-10-01')).toEqual([intoOctober])
    expect(eventsOnDay([intoOctober], '2026-10-03')).toEqual([])
  })

  test('matches a range that ends on its start day', () => {
    const sameDay: CalendarEvent = {
      ...base,
      id: '4',
      date: '2026-09-05',
      until: '2026-09-05'
    }
    expect(eventsOnDay([sameDay], '2026-09-05')).toEqual([sameDay])
  })
})

describe('isoDate', () => {
  test('zero-pads month and day', () => {
    expect(isoDate(2024, 0, 5)).toBe('2024-01-05')
  })

  test('leaves double-digit month and day alone', () => {
    expect(isoDate(2024, 10, 23)).toBe('2024-11-23')
  })
})

describe('longDate', () => {
  test('spells out the month name', () => {
    expect(longDate('2024-01-05', 'en')).toBe('January 5, 2024')
    expect(longDate('2026-12-31', 'en')).toBe('December 31, 2026')
  })

  test('follows the given locale', () => {
    expect(longDate('2024-01-05', 'es')).toBe('5 de enero de 2024')
  })
})

describe('shortDate', () => {
  test('abbreviates the weekday and month, with no year', () => {
    expect(shortDate('2024-01-05', 'en')).toBe('Fri, Jan 5')
    expect(shortDate('2026-12-31', 'en')).toBe('Thu, Dec 31')
  })

  test('follows the given locale', () => {
    expect(shortDate('2024-01-05', 'es')).toBe('vie, 5 ene')
  })
})

describe('monthLabel', () => {
  test('names the month and year', () => {
    expect(monthLabel(2027, 0, 'en')).toBe('January 2027')
  })

  test('follows the given locale', () => {
    expect(monthLabel(2026, 8, 'es')).toBe('septiembre de 2026')
    expect(monthLabel(2026, 8, 'gl')).toBe('setembro de 2026')
  })
})

describe('indexBy', () => {
  test('keys items by their key field', () => {
    const other: ObjectType = { ...TASK, key: 'sp_1:project' }
    const map = indexBy([TASK, other])
    expect(map.get(TASK.key)).toBe(TASK)
    expect(map.get(other.key)).toBe(other)
    expect(map.size).toBe(2)
  })
})

describe('typesInSpace', () => {
  test('keeps only types in the given space', () => {
    const other: ObjectType = { ...TASK, key: 'sp_2:task', space: 'sp_2' }
    expect(typesInSpace([TASK, other], 'sp_1')).toEqual([TASK])
  })
})

describe('dateLabel', () => {
  test('returns the label of a known property', () => {
    expect(dateLabel(TASK, 'due_date')).toBe('Due date')
  })

  test('falls back to the key for a property the type no longer has', () => {
    expect(dateLabel(TASK, 'gone_date')).toBe('gone_date')
  })
})

describe('offersDates', () => {
  test('true for a from-only mapping the type still has', () => {
    expect(offersDates(TASK, { from: 'due_date', to: null, includesTime: false })).toBe(true)
  })

  test('true for a range whose both ends the type still has', () => {
    expect(
      offersDates(TASK, {
        from: 'due_date',
        to: 'start_date',
        includesTime: false
      })
    ).toBe(true)
  })

  test('false when the from property is gone', () => {
    expect(offersDates(TASK, { from: 'gone_date', to: null, includesTime: false })).toBe(false)
  })

  test('false when the to property is gone', () => {
    expect(
      offersDates(TASK, {
        from: 'due_date',
        to: 'gone_date',
        includesTime: false
      })
    ).toBe(false)
  })
})

describe('withDates', () => {
  const other: ObjectType = { ...TASK, key: 'sp_1:project' }

  test('gives a type with an entry those dates, and leaves the rest as they are', () => {
    const [task, project] = withDates([TASK, other], {
      'sp_1:task': { from: 'start_date', to: 'due_date', includesTime: true }
    })
    expect(task).toEqual({
      ...TASK,
      from: 'start_date',
      to: 'due_date',
      includesTime: true
    })
    expect(project).toBe(other)
  })
})

describe('dateOptions', () => {
  test('maps each date property to an option', () => {
    expect(dateOptions(TASK)).toEqual([
      { value: 'due_date', label: 'Due date' },
      { value: 'start_date', label: 'Start date' }
    ])
  })
})

describe('spacesByKeys', () => {
  const personal: Space = { key: 'sp_1', name: 'Personal' }
  const work: Space = { key: 'sp_2', name: 'Work' }

  test('keeps only the spaces whose key was picked', () => {
    expect(spacesByKeys([personal, work], ['sp_2'])).toEqual([work])
  })

  test('keeps original order regardless of the key order given', () => {
    expect(spacesByKeys([personal, work], ['sp_2', 'sp_1'])).toEqual([personal, work])
  })

  test('ignores a picked key with no matching space', () => {
    expect(spacesByKeys([personal], ['sp_9'])).toEqual([])
  })
})

describe('isoWeekNumber', () => {
  test('counts ordinary weeks from Monday', () => {
    expect(isoWeekNumber('2026-09-21')).toBe(39)
    expect(isoWeekNumber('2026-09-27')).toBe(39)
    expect(isoWeekNumber('2026-09-28')).toBe(40)
  })

  test("puts the days before the first Thursday in the previous year's last week", () => {
    expect(isoWeekNumber('2021-01-01')).toBe(53)
    expect(isoWeekNumber('2021-01-03')).toBe(53)
    expect(isoWeekNumber('2021-01-04')).toBe(1)
  })

  test("puts the last days of December in week 1 when their week holds January's first Thursday", () => {
    expect(isoWeekNumber('2024-12-29')).toBe(52)
    expect(isoWeekNumber('2024-12-30')).toBe(1)
    expect(isoWeekNumber('2025-12-29')).toBe(1)
  })
})

describe('formatTime', () => {
  test('leaves a 24-hour time zero-padded', () => {
    expect(formatTime('13:05', '24h', 'en')).toBe('13:05')
    expect(formatTime('09:00', '24h', 'en')).toBe('09:00')
  })

  test('draws afternoon hours as PM', () => {
    expect(formatTime('13:05', '12h', 'en')).toBe('1:05 PM')
    expect(formatTime('12:00', '12h', 'en')).toBe('12:00 PM')
  })

  test('draws midnight as 12 AM and the morning as AM', () => {
    expect(formatTime('00:30', '12h', 'en')).toBe('12:30 AM')
    expect(formatTime('09:00', '12h', 'en')).toBe('9:00 AM')
  })

  test('follows the given locale', () => {
    expect(formatTime('13:05', '12h', 'es')).toContain('1:05')
  })
})

describe('addDays', () => {
  test('moves within a month, and across one', () => {
    expect(addDays('2026-09-14', 3)).toBe('2026-09-17')
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30')
  })

  test('crosses the turn of the year', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })

  test('stays put for no shift', () => {
    expect(addDays('2026-09-14', 0)).toBe('2026-09-14')
  })
})

describe('buildWeek', () => {
  // 2026-09-23 is a Wednesday.
  test("opens on the user's own first day of the week", () => {
    expect(buildWeek('2026-09-23', 0).map((day) => day.date)).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27'
    ])
    expect(buildWeek('2026-09-23', 6)[0]?.date).toBe('2026-09-20')
  })

  test('straddles a month, and a year', () => {
    expect(buildWeek('2026-10-01', 0).map((day) => day.date)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04'
    ])
    expect(buildWeek('2027-01-01', 0)[0]?.date).toBe('2026-12-28')
  })

  test('borrows nothing: every day of a week is its own', () => {
    expect(buildWeek('2026-10-01', 0).every((day) => !day.outside)).toBe(true)
  })
})

describe('dayLabel', () => {
  test('spells the weekday out', () => {
    expect(dayLabel('2026-09-23', 'en')).toBe('Wednesday, September 23, 2026')
  })
})

describe('weekLabel', () => {
  // Intl separates a range with thin spaces around the dash, which are not worth asserting.
  const label = (start: string, end: string): string =>
    weekLabel(start, end, 'en').replace(/\s+/g, ' ')

  test('names the month once for a week inside one', () => {
    expect(label('2026-09-21', '2026-09-27')).toBe('Sep 21 – 27, 2026')
  })

  test('names both months for a week that straddles two', () => {
    expect(label('2026-09-28', '2026-10-04')).toBe('Sep 28 – Oct 4, 2026')
  })

  test('names both years across New Year', () => {
    expect(label('2026-12-28', '2027-01-03')).toBe('Dec 28, 2026 – Jan 3, 2027')
  })
})
