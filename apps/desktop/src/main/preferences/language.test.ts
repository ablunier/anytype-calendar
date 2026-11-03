import { describe, expect, test } from 'vitest'
import { toLanguage } from './language'

describe('toLanguage', () => {
  test('accepts a supported language', () => {
    expect(toLanguage('en')).toBe('en')
    expect(toLanguage('es')).toBe('es')
    expect(toLanguage('gl')).toBe('gl')
  })

  test('accepts an explicit null as "follow the OS"', () => {
    expect(toLanguage(null)).toBeNull()
  })

  test('is undefined for anything else', () => {
    expect(toLanguage('fr')).toBeUndefined()
    expect(toLanguage(undefined)).toBeUndefined()
    expect(toLanguage(1)).toBeUndefined()
  })
})
