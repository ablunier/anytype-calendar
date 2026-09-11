import { describe, expect, test, vi } from 'vitest'
import { AuthSessionStore } from './session-store'
import { StepBackAuthConnection } from './step-back-auth-connection'

describe('stepBack', () => {
  test('returns to signed-out from an open challenge', () => {
    const store = new AuthSessionStore({
      phase: 'awaiting-code',
      challenge: { id: 'ch_1', expiresAt: 60_000 }
    })
    const stepBackAuthConnection = new StepBackAuthConnection(store)

    stepBackAuthConnection.execute()

    expect(store.get()).toEqual({ phase: 'signed-out' })
  })

  test('notifies no one when already signed out', () => {
    const store = new AuthSessionStore()
    const stepBackAuthConnection = new StepBackAuthConnection(store)
    const listener = vi.fn()
    store.subscribe(listener)

    stepBackAuthConnection.execute()

    expect(listener).not.toHaveBeenCalled()
  })
})
