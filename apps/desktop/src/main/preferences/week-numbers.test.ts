import { describe, expect, test } from 'vitest'
import { toWeekNumbers } from './week-numbers'

describe('toWeekNumbers', () => {
  test('accepts only booleans', () => {
    expect(toWeekNumbers(true)).toBe(true)
    expect(toWeekNumbers(false)).toBe(false)
    expect(toWeekNumbers('true')).toBeUndefined()
    expect(toWeekNumbers(null)).toBeUndefined()
  })
})
