import { describe, expect, test } from 'vitest'
import { authAccessCanWrite, sameAuthAccess, type AuthAccess } from './access'

const grant = { allSpaces: false, spaceIds: ['sp_1', 'sp_2'], permission: 'read' as const }

describe('sameAuthAccess', () => {
  test('compares every part of the grant', () => {
    const access: AuthAccess = { grant }
    expect(sameAuthAccess(access, { grant: { ...grant } })).toBe(true)
    expect(sameAuthAccess(access, { grant: null })).toBe(false)
    expect(sameAuthAccess(access, { grant: { ...grant, permission: 'readwrite' } })).toBe(false)
    expect(sameAuthAccess(access, { grant: { ...grant, spaceIds: ['sp_1'] } })).toBe(false)
    expect(sameAuthAccess(access, { grant: { ...grant, spaceIds: ['sp_2', 'sp_1'] } })).toBe(false)
  })

  test('holds two keys with no grant the same', () => {
    expect(sameAuthAccess({ grant: null }, { grant: null })).toBe(true)
  })
})

describe('authAccessCanWrite', () => {
  test('lets a key write when it was granted read/write, or has no grant of its own', () => {
    const grant = { allSpaces: false, spaceIds: ['sp_1'], permission: 'readwrite' } as const
    expect(authAccessCanWrite({ grant })).toBe(true)
    expect(authAccessCanWrite({ grant: null })).toBe(true)
    expect(authAccessCanWrite({ grant: { ...grant, permission: 'read' } })).toBe(false)
  })

  test('never lets a key Anytype has not yet been asked about write', () => {
    expect(authAccessCanWrite(null)).toBe(false)
  })
})
