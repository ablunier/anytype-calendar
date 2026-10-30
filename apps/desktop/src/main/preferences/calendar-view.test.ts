import { describe, expect, test } from 'vitest'
import { toCalendarView } from './calendar-view'

describe('toCalendarView', () => {
  test('accepts only the three views', () => {
    expect(toCalendarView('month')).toBe('month')
    expect(toCalendarView('week')).toBe('week')
    expect(toCalendarView('day')).toBe('day')
    expect(toCalendarView('year')).toBeUndefined()
    expect(toCalendarView('Month')).toBeUndefined()
    expect(toCalendarView(0)).toBeUndefined()
    expect(toCalendarView(null)).toBeUndefined()
  })
})
