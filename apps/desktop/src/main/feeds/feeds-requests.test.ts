import { describe, expect, test } from 'vitest'
import { isFeedsId, toFeedsAddRequest, toFeedsEditRequest, toFeedsOrder } from './feeds-requests'

describe('adding', () => {
  test('keeps the address and the name, and nothing else', () => {
    expect(toFeedsAddRequest({ url: 'webcal://example.com/a.ics', name: '', extra: 1 })).toEqual({
      url: 'webcal://example.com/a.ics',
      name: ''
    })
  })

  test('refuses what is not text, or an address far too long', () => {
    expect(toFeedsAddRequest({ url: 'https://example.com/a.ics' })).toBeNull()
    expect(toFeedsAddRequest({ url: 42, name: 'X' })).toBeNull()
    expect(toFeedsAddRequest({ url: `https://example.com/${'a'.repeat(9000)}`, name: 'X' })).toBeNull()
    expect(toFeedsAddRequest(null)).toBeNull()
  })
})

describe('editing', () => {
  test('keeps the fields given, the name trimmed', () => {
    expect(toFeedsEditRequest({ id: 'a1', name: ' Family ', colour: 'pink' })).toEqual({
      id: 'a1',
      name: 'Family',
      colour: 'pink'
    })
    expect(toFeedsEditRequest({ id: 'a1', colour: 'teal' })).toEqual({ id: 'a1', colour: 'teal' })
  })

  test('refuses an empty name, an unknown colour, or a malformed id', () => {
    expect(toFeedsEditRequest({ id: 'a1', name: '  ' })).toBeNull()
    expect(toFeedsEditRequest({ id: 'a1', colour: 'chartreuse' })).toBeNull()
    expect(toFeedsEditRequest({ id: '../a', name: 'X' })).toBeNull()
  })
})

describe('reordering', () => {
  test('takes a list of ids', () => {
    expect(toFeedsOrder(['b2', 'a1'])).toEqual(['b2', 'a1'])
    expect(toFeedsOrder(['b2', 3])).toBeNull()
    expect(toFeedsOrder('b2')).toBeNull()
  })
})

test('an id is what the app makes one of', () => {
  expect(isFeedsId('0f3a9c')).toBe(true)
  expect(isFeedsId('')).toBe(false)
  expect(isFeedsId('a/b')).toBe(false)
})
