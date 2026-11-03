import { describe, expect, test } from 'vitest'
import { sameCalendarVisibility, toCalendarVisibility } from './calendar-visibility'

describe('toCalendarVisibility', () => {
  test('reads hidden keys and the collapsed flag', () => {
    expect(toCalendarVisibility({ hidden: ['a', 'b'], collapsed: true, collapsedSpaces: ['sp_1'] })).toEqual({
      hidden: ['a', 'b'],
      collapsed: true,
      collapsedSpaces: ['sp_1']
    })
  })

  test('keeps a repeated key once, and drops what is not a key', () => {
    expect(toCalendarVisibility({ hidden: ['a', 'a', 3, '', null, 'b'], collapsed: false })).toEqual({
      hidden: ['a', 'b'],
      collapsed: false,
      collapsedSpaces: []
    })
  })

  test('defaults a field that is malformed without discarding the other', () => {
    expect(toCalendarVisibility({ hidden: 'a', collapsed: true })).toEqual({ hidden: [], collapsed: true, collapsedSpaces: [] })
    expect(toCalendarVisibility({ hidden: ['a'], collapsed: 'yes' })).toEqual({
      hidden: ['a'],
      collapsed: false,
      collapsedSpaces: []
    })
  })

  test('refuses what is not an object', () => {
    expect(toCalendarVisibility(null)).toBeUndefined()
    expect(toCalendarVisibility(true)).toBeUndefined()
    expect(toCalendarVisibility('hidden')).toBeUndefined()
  })
})

describe('sameCalendarVisibility', () => {
  test('compares the keys, not the arrays holding them', () => {
    const visibility = { hidden: ['a'], collapsed: false, collapsedSpaces: ['sp_1'] }
    expect(sameCalendarVisibility(visibility, { hidden: ['a'], collapsed: false, collapsedSpaces: ['sp_1'] })).toBe(true)
    expect(sameCalendarVisibility(visibility, { ...visibility, hidden: ['b'] })).toBe(false)
    expect(sameCalendarVisibility(visibility, { ...visibility, collapsed: true })).toBe(false)
    expect(sameCalendarVisibility(visibility, { ...visibility, collapsedSpaces: [] })).toBe(false)
  })
})
