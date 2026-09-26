import { describe, expect, test, vi } from 'vitest'
import type { AuthCredential, CredentialRepository } from '../domain'
import { RestoreAuthSession } from './restore-auth-session'
import { AuthSessionStore } from './session-store'

const API_KEY = 'ak_secret_4c19'

function setup(initialCredential: AuthCredential | null = null) {
  const credentials = {
    load: vi.fn<CredentialRepository['load']>(async () => initialCredential),
    save: vi.fn<CredentialRepository['save']>(async () => {}),
    clear: vi.fn<CredentialRepository['clear']>(async () => {})
  }
  const store = new AuthSessionStore()
  const restoreAuthSession = new RestoreAuthSession({ credentials, store })
  return { store, restoreAuthSession }
}

describe('restore', () => {
  test('stays signed out when nothing is stored', async () => {
    const { store, restoreAuthSession } = setup()
    await restoreAuthSession.execute()
    expect(store.get()).toEqual({ phase: 'signed-out' })
  })

  test('connects from a stored credential without exposing the key', async () => {
    const { store, restoreAuthSession } = setup({ apiKey: API_KEY, issuedAt: 42 })
    await restoreAuthSession.execute()
    expect(store.get()).toEqual({
      phase: 'connected',
      key: { hint: '4c19', issuedAt: 42 },
      access: null
    })
    expect(JSON.stringify(store.get())).not.toContain(API_KEY)
  })
})
