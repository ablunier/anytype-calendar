import { describe, expect, test } from 'vitest'
import type { CalendarEvent, ObjectType, Space } from '@renderer/types'
import {
  buildMonthGrid,
  dateLabel,
  dateOptions,
  eventsOnDay,
  indexBy,
  isoDate,
  longDate,
  offersDates,
  spacesByKeys,
  typesInSpace
} from './calendar'

const TASK: ObjectType = {
  key: 'sp_1:task',
  space: 'sp_1',
  label: 'Task',
  category: 'denim',
  icon: 'calendar',
  count: 3,
  props: [
    { key: 'due_date', label: 'Due date' },
    { key: 'start_date', label: 'Start date' }
  ],
  from: 'due_date',
  to: null
}

describe('buildMonthGrid', () => {
  test('pads a month that starts after Monday with the previous month', () => {
    // February 2024: 1 Feb is a Thursday, so the grid borrows Mon-Wed from January.
    const grid = buildMonthGrid(2024, 1)
    expect(grid.slice(0, 3)).toEqual([
      { day: 29, outside: true },
      { day: 30, outside: true },
      { day: 31, outside: true }
    ])
    expect(grid[3]).toEqual({ day: 1, outside: false })
    expect(grid.at(-1)).toEqual({ day: 3, outside: true })
    expect(grid).toHaveLength(35)
  })

  test('starts on Monday with no leading days, and pads a full last row', () => {
    // September 2025: 1 Sep is a Monday; 30 days leaves the grid 2 short of a full row.
    const grid = buildMonthGrid(2025, 8)
    expect(grid[0]).toEqual({ day: 1, outside: false })
    expect(grid.slice(30)).toEqual([
      { day: 1, outside: true },
      { day: 2, outside: true },
      { day: 3, outside: true },
      { day: 4, outside: true },
      { day: 5, outside: true }
    ])
    expect(grid).toHaveLength(35)
  })

  test('every row is 7 long', () => {
    const grid = buildMonthGrid(2024, 1)
    expect(grid.length % 7).toBe(0)
  })
})

describe('eventsOnDay', () => {
  const single: CalendarEvent = { id: 1, day: 5, title: 'Single', type: TASK.key }
  const range: CalendarEvent = { id: 2, day: 5, title: 'Range', type: TASK.key, until: 8 }

  test('matches a single-day event only on its day', () => {
    expect(eventsOnDay([single], 5)).toEqual([single])
    expect(eventsOnDay([single], 6)).toEqual([])
  })

  test('matches a ranged event across its whole span', () => {
    expect(eventsOnDay([range], 5)).toEqual([range])
    expect(eventsOnDay([range], 7)).toEqual([range])
    expect(eventsOnDay([range], 8)).toEqual([range])
    expect(eventsOnDay([range], 4)).toEqual([])
    expect(eventsOnDay([range], 9)).toEqual([])
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
    expect(longDate(2024, 0, 5)).toBe('5 January 2024')
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
    expect(offersDates(TASK, { from: 'due_date', to: null })).toBe(true)
  })

  test('true for a range whose both ends the type still has', () => {
    expect(offersDates(TASK, { from: 'due_date', to: 'start_date' })).toBe(true)
  })

  test('false when the from property is gone', () => {
    expect(offersDates(TASK, { from: 'gone_date', to: null })).toBe(false)
  })

  test('false when the to property is gone', () => {
    expect(offersDates(TASK, { from: 'due_date', to: 'gone_date' })).toBe(false)
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
  const personal: Space = { key: 'sp_1', name: 'Personal', objects: 4 }
  const work: Space = { key: 'sp_2', name: 'Work', objects: 9 }

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
