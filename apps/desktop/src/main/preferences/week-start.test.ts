import { describe, expect, test } from 'vitest'
import { toWeekStart } from './week-start'

describe('toWeekStart', () => {
  test('accepts only the integers 0 to 6', () => {
    expect(toWeekStart(0)).toBe(0)
    expect(toWeekStart(6)).toBe(6)
    expect(toWeekStart(7)).toBeUndefined()
    expect(toWeekStart(-1)).toBeUndefined()
    expect(toWeekStart(1.5)).toBeUndefined()
    expect(toWeekStart('1')).toBeUndefined()
    expect(toWeekStart(null)).toBeUndefined()
  })
})
