import { expect, test, vi } from 'vitest'
import type { AuthSession } from '../domain'
import { AuthSessionStore } from './session-store'

const awaitingCode: AuthSession = {
  phase: 'awaiting-code',
  challenge: { id: 'ch_1', expiresAt: 60_000 }
}

test('starts signed out', () => {
  expect(new AuthSessionStore().get()).toEqual({ phase: 'signed-out' })
})

test('notifies subscribers of a new session', () => {
  const store = new AuthSessionStore()
  const listener = vi.fn()
  store.subscribe(listener)

  store.set(awaitingCode)

  expect(store.get()).toBe(awaitingCode)
  expect(listener).toHaveBeenCalledExactlyOnceWith(awaitingCode)
})

test('setting the current object again notifies no one', () => {
  const store = new AuthSessionStore(awaitingCode)
  const listener = vi.fn()
  store.subscribe(listener)

  store.set(awaitingCode)

  expect(listener).not.toHaveBeenCalled()
})

test('an unsubscribed listener hears nothing more', () => {
  const store = new AuthSessionStore()
  const listener = vi.fn()
  const unsubscribe = store.subscribe(listener)

  unsubscribe()
  store.set(awaitingCode)

  expect(listener).not.toHaveBeenCalled()
})
