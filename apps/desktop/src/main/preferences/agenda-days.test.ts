import { describe, expect, test } from 'vitest'
import { toAgendaDays } from './agenda-days'

describe('toAgendaDays', () => {
  test('accepts one, two or four weeks', () => {
    expect(toAgendaDays(7)).toBe(7)
    expect(toAgendaDays(14)).toBe(14)
    expect(toAgendaDays(28)).toBe(28)
  })

  test('is undefined for any other length, so it loads as the default', () => {
    expect(toAgendaDays(10)).toBeUndefined()
    expect(toAgendaDays(21)).toBeUndefined()
    expect(toAgendaDays('14')).toBeUndefined()
    expect(toAgendaDays(null)).toBeUndefined()
    expect(toAgendaDays(undefined)).toBeUndefined()
  })
})
