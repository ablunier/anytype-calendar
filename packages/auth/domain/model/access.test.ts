import { describe, expect, test } from 'vitest'
import { sameAuthAccess, type AuthAccess } from './access'

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
