import { describe, expect, test } from 'vitest'
import { authAccessCanWrite, sameAuthAccess, type AuthAccess } from './access'

const grant = { allSpaces: false, spaceIds: ['sp_1', 'sp_2'], permission: 'read' as const }

describe('sameAuthAccess', () => {
  test('compares the major and every part of the grant', () => {
    const access: AuthAccess = { apiVersion: 'v2', grant }
    expect(sameAuthAccess(access, { apiVersion: 'v2', grant: { ...grant } })).toBe(true)
    expect(sameAuthAccess(access, { apiVersion: 'v1', grant })).toBe(false)
    expect(sameAuthAccess(access, { apiVersion: 'v2', grant: null })).toBe(false)
    expect(sameAuthAccess(access, { apiVersion: 'v2', grant: { ...grant, permission: 'readwrite' } })).toBe(false)
    expect(sameAuthAccess(access, { apiVersion: 'v2', grant: { ...grant, spaceIds: ['sp_1'] } })).toBe(false)
    expect(sameAuthAccess(access, { apiVersion: 'v2', grant: { ...grant, spaceIds: ['sp_2', 'sp_1'] } })).toBe(false)
  })

  test('holds two keys with no grant the same', () => {
    expect(sameAuthAccess({ apiVersion: 'v1', grant: null }, { apiVersion: 'v1', grant: null })).toBe(true)
  })
})

describe('authAccessCanWrite', () => {
  test('lets a v2 key write when it was granted read/write, or has no grant of its own', () => {
    const grant = { allSpaces: false, spaceIds: ['sp_1'], permission: 'readwrite' } as const
    expect(authAccessCanWrite({ apiVersion: 'v2', grant })).toBe(true)
    expect(authAccessCanWrite({ apiVersion: 'v2', grant: null })).toBe(true)
    expect(authAccessCanWrite({ apiVersion: 'v2', grant: { ...grant, permission: 'read' } })).toBe(false)
  })

  test('never lets v1 write, nor a key Anytype has not yet been asked about', () => {
    expect(authAccessCanWrite({ apiVersion: 'v1', grant: null })).toBe(false)
    expect(authAccessCanWrite(null)).toBe(false)
  })
})
