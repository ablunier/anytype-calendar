import { describe, expect, test } from 'vitest'
import { toTimeFormat } from './time-format'

describe('toTimeFormat', () => {
  test('accepts only 24h and 12h', () => {
    expect(toTimeFormat('24h')).toBe('24h')
    expect(toTimeFormat('12h')).toBe('12h')
    expect(toTimeFormat('12')).toBeUndefined()
    expect(toTimeFormat(12)).toBeUndefined()
    expect(toTimeFormat(null)).toBeUndefined()
  })
})
