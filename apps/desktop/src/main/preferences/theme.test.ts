import { describe, expect, test } from 'vitest'
import { toTheme } from './theme'

describe('toTheme', () => {
  test('accepts a theme', () => {
    expect(toTheme('light')).toBe('light')
    expect(toTheme('dark')).toBe('dark')
  })

  test('is undefined for anything else, null included', () => {
    expect(toTheme('blue')).toBeUndefined()
    expect(toTheme(null)).toBeUndefined()
    expect(toTheme(undefined)).toBeUndefined()
  })
})
