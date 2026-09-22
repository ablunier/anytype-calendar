import { describe, expect, test } from 'vitest'
import { resolveLocale } from './locale'

describe('resolveLocale', () => {
  test('an explicit preference wins over the OS locale', () => {
    expect(resolveLocale('es', ['en-US'])).toBe('es')
  })

  test('null follows the first system locale that matches a shipped one', () => {
    expect(resolveLocale(null, ['fr-FR', 'es-ES', 'en-US'])).toBe('es')
  })

  test('matches by primary subtag, ignoring the region', () => {
    expect(resolveLocale(null, ['gl-ES'])).toBe('gl')
  })

  test('falls back to English when nothing matches', () => {
    expect(resolveLocale(null, ['fr-FR', 'de-DE'])).toBe('en')
  })

  test('falls back to English when there are no system locales at all', () => {
    expect(resolveLocale(null, [])).toBe('en')
  })
})
