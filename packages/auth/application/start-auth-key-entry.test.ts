import { describe, expect, test, vi } from 'vitest'
import { AuthSessionStore } from './session-store'
import { StartAuthKeyEntry } from './start-auth-key-entry'

describe('startAuthKeyEntry', () => {
  test('switches from signed-out to entering a key', () => {
    const store = new AuthSessionStore()
    const startAuthKeyEntry = new StartAuthKeyEntry(store)

    startAuthKeyEntry.execute()

    expect(store.get()).toEqual({ phase: 'entering-key' })
  })

  test('notifies no one once already past signed-out', () => {
    const store = new AuthSessionStore({
      phase: 'connected',
      key: { hint: '4c19', issuedAt: 0 },
      access: null
    })
    const startAuthKeyEntry = new StartAuthKeyEntry(store)
    const listener = vi.fn()
    store.subscribe(listener)

    startAuthKeyEntry.execute()

    expect(listener).not.toHaveBeenCalled()
  })
})
