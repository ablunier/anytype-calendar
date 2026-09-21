import { describe, expect, test } from 'vitest'
import type { CalendarEvent, ObjectType, Space } from '@renderer/types'
import {
  buildMonthGrid,
  dateLabel,
  dateOptions,
  eventsOnDay,
  indexBy,
  isoDate,
  isoWeekNumber,
  longDate,
  monthLabel,
  offersDates,
  shortDate,
  spacesByKeys,
  typesInSpace,
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
    expect(longDate('2024-01-05')).toBe('5 January 2024')
    expect(longDate('2026-12-31')).toBe('31 December 2026')
  })
})

describe('shortDate', () => {
  test('abbreviates the weekday and month, with no year', () => {
    expect(shortDate('2024-01-05')).toBe('Fri Jan 5')
    expect(shortDate('2026-12-31')).toBe('Thu Dec 31')
  })
})

describe('monthLabel', () => {
  test('names the month and year', () => {
    expect(monthLabel(2027, 0)).toBe('January 2027')
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
