import { describe, expect, test, vi } from 'vitest'
import { AUTH_CHALLENGE_LIFETIME_MS, type AuthChallengeResult, type AuthGateway } from '../domain'
import { AuthSessionStore } from './session-store'
import { StartAuthConnection } from './start-auth-connection'
import { StepBackAuthConnection } from './step-back-auth-connection'

const START = 1_000

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function setup() {
  const gateway = {
    createChallenge: vi.fn<AuthGateway['createChallenge']>(async () => ({ ok: true, challengeId: 'ch_1' })),
    exchangeCode: vi.fn<AuthGateway['exchangeCode']>(async () => ({
      ok: true,
      apiKey: 'unused',
      access: { grant: null }
    }))
  }
  const store = new AuthSessionStore()
  const startAuthConnection = new StartAuthConnection({
    gateway,
    store,
    appName: 'Test app',
    now: () => START
  })
  const stepBackAuthConnection = new StepBackAuthConnection(store)
  return { gateway, store, startAuthConnection, stepBackAuthConnection }
}

describe('startConnection', () => {
  test('opens a challenge under the app name, stamped with its lifetime', async () => {
    const { gateway, store, startAuthConnection } = setup()
    await startAuthConnection.execute()
    expect(gateway.createChallenge).toHaveBeenCalledExactlyOnceWith('Test app')
    expect(store.get()).toEqual({
      phase: 'awaiting-code',
      challenge: { id: 'ch_1', expiresAt: START + AUTH_CHALLENGE_LIFETIME_MS }
    })
  })

  test('fails as unreachable when the challenge cannot be opened', async () => {
    const { store, gateway, startAuthConnection } = setup()
    gateway.createChallenge.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    await startAuthConnection.execute()
    expect(store.get()).toEqual({ phase: 'failed', failure: 'unreachable' })
  })

  test('fails as outdated when Anytype is too old to pair with', async () => {
    const { store, gateway, startAuthConnection } = setup()
    gateway.createChallenge.mockResolvedValueOnce({ ok: false, failure: 'outdated' })
    await startAuthConnection.execute()
    expect(store.get()).toEqual({ phase: 'failed', failure: 'outdated' })
  })

  test('drops a challenge that arrives after the user stepped back', async () => {
    const { store, gateway, startAuthConnection, stepBackAuthConnection } = setup()
    await startAuthConnection.execute()
    const next = deferred<AuthChallengeResult>()
    gateway.createChallenge.mockReturnValueOnce(next.promise)

    const requesting = startAuthConnection.execute()
    stepBackAuthConnection.execute()
    next.resolve({ ok: true, challengeId: 'ch_2' })
    await requesting

    expect(store.get()).toEqual({ phase: 'signed-out' })
  })
})
