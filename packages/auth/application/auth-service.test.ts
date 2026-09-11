import { describe, expect, test, vi } from 'vitest'
import {
  AUTH_CHALLENGE_LIFETIME_MS,
  type AuthCredential,
  type AuthExchangeResult,
  type AuthGateway,
  type CredentialRepository
} from '../domain'
import { AuthService } from './auth-service'
import { AuthSessionStore } from './session-store'

const VALID_CODE = '2749'
const API_KEY = 'ak_secret_4c19'
const START = 1_000

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function setup(initialCredential: AuthCredential | null = null) {
  let time = START
  let credential = initialCredential

  const gateway = {
    createChallenge: vi.fn<AuthGateway['createChallenge']>(async () => 'ch_1'),
    exchangeCode: vi.fn<AuthGateway['exchangeCode']>(async (_challengeId, code) =>
      code === VALID_CODE ? { ok: true, apiKey: API_KEY } : { ok: false, failure: 'invalid-code' }
    ),
    revokeKey: vi.fn<AuthGateway['revokeKey']>(async () => {})
  }
  const credentials = {
    load: vi.fn<CredentialRepository['load']>(async () => credential),
    save: vi.fn<CredentialRepository['save']>(async (next) => {
      credential = next
    }),
    clear: vi.fn<CredentialRepository['clear']>(async () => {
      credential = null
    })
  }
  const store = new AuthSessionStore()
  const service = new AuthService({
    gateway,
    credentials,
    store,
    appName: 'Test app',
    now: () => time
  })

  return {
    service,
    store,
    gateway,
    credentials,
    stored: () => credential,
    advance: (ms: number) => {
      time += ms
    }
  }
}

async function connected() {
  const harness = setup()
  await harness.service.startConnection()
  await harness.service.submitCode(VALID_CODE)
  return harness
}

describe('restore', () => {
  test('stays signed out when nothing is stored', async () => {
    const { service, store } = setup()
    await service.restore()
    expect(store.get()).toEqual({ phase: 'signed-out' })
  })

  test('connects from a stored credential without exposing the key', async () => {
    const { service, store } = setup({ apiKey: API_KEY, issuedAt: 42 })
    await service.restore()
    expect(store.get()).toEqual({ phase: 'connected', key: { hint: '4c19', issuedAt: 42 } })
    expect(JSON.stringify(store.get())).not.toContain(API_KEY)
  })
})

describe('startConnection', () => {
  test('opens a challenge under the app name, stamped with its lifetime', async () => {
    const { service, store, gateway } = setup()
    await service.startConnection()
    expect(gateway.createChallenge).toHaveBeenCalledExactlyOnceWith('Test app')
    expect(store.get()).toEqual({
      phase: 'awaiting-code',
      challenge: { id: 'ch_1', expiresAt: START + AUTH_CHALLENGE_LIFETIME_MS }
    })
  })

  test('fails as unreachable when the challenge cannot be opened', async () => {
    const { service, store, gateway } = setup()
    gateway.createChallenge.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    await service.startConnection()
    expect(store.get()).toEqual({ phase: 'failed', failure: 'unreachable' })
  })

  test('drops a challenge that arrives after the user stepped back', async () => {
    const { service, store, gateway } = setup()
    await service.startConnection()
    const next = deferred<string>()
    gateway.createChallenge.mockReturnValueOnce(next.promise)

    const requesting = service.startConnection()
    service.stepBack()
    next.resolve('ch_2')
    await requesting

    expect(store.get()).toEqual({ phase: 'signed-out' })
  })
})

describe('submitCode', () => {
  test('connects with the right code, storing the credential and exposing only its hint', async () => {
    const { service, store, gateway, stored, advance } = setup()
    await service.startConnection()
    advance(5_000)
    await service.submitCode(VALID_CODE)

    expect(gateway.exchangeCode).toHaveBeenCalledExactlyOnceWith('ch_1', VALID_CODE)
    expect(stored()).toEqual({ apiKey: API_KEY, issuedAt: START + 5_000 })
    expect(store.get()).toEqual({
      phase: 'connected',
      key: { hint: '4c19', issuedAt: START + 5_000 }
    })
    expect(JSON.stringify(store.get())).not.toContain(API_KEY)
  })

  test('is verifying while the exchange is in flight', async () => {
    const { service, store, gateway } = setup()
    await service.startConnection()
    const exchange = deferred<AuthExchangeResult>()
    gateway.exchangeCode.mockReturnValueOnce(exchange.promise)

    const submitting = service.submitCode(VALID_CODE)
    expect(store.get().phase).toBe('verifying')

    exchange.resolve({ ok: true, apiKey: API_KEY })
    await submitting
    expect(store.get().phase).toBe('connected')
  })

  test('fails with the attempt kept when Anytype rejects the code', async () => {
    const { service, store, stored } = setup()
    await service.startConnection()
    await service.submitCode('1111')

    expect(store.get()).toEqual({
      phase: 'failed',
      failure: 'invalid-code',
      attempt: { challenge: expect.objectContaining({ id: 'ch_1' }), code: '1111' }
    })
    expect(stored()).toBeNull()
  })

  test('fails as expired without asking Anytype once the challenge has lapsed', async () => {
    const { service, store, gateway, advance } = setup()
    await service.startConnection()
    advance(AUTH_CHALLENGE_LIFETIME_MS)
    await service.submitCode(VALID_CODE)

    expect(store.get()).toMatchObject({ phase: 'failed', failure: 'expired' })
    expect(gateway.exchangeCode).not.toHaveBeenCalled()
  })

  test('ignores a malformed code', async () => {
    const { service, store, gateway } = setup()
    await service.startConnection()
    const before = store.get()
    await service.submitCode('27')

    expect(store.get()).toBe(before)
    expect(gateway.exchangeCode).not.toHaveBeenCalled()
  })

  test('fails as unreachable when the exchange cannot reach Anytype', async () => {
    const { service, store, gateway } = setup()
    await service.startConnection()
    gateway.exchangeCode.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    await service.submitCode(VALID_CODE)

    expect(store.get()).toMatchObject({ phase: 'failed', failure: 'unreachable' })
  })

  test('a repeated submit does not start a second exchange or void the first', async () => {
    const { service, store, gateway } = setup()
    await service.startConnection()
    const exchange = deferred<AuthExchangeResult>()
    gateway.exchangeCode.mockReturnValueOnce(exchange.promise)

    const first = service.submitCode(VALID_CODE)
    const second = service.submitCode(VALID_CODE)
    exchange.resolve({ ok: true, apiKey: API_KEY })
    await Promise.all([first, second])

    expect(gateway.exchangeCode).toHaveBeenCalledOnce()
    expect(store.get().phase).toBe('connected')
  })
})

describe('late exchange results', () => {
  test('a success after stepping back is never stored, and its key is revoked in Anytype', async () => {
    const { service, store, gateway, credentials } = setup()
    await service.startConnection()
    const exchange = deferred<AuthExchangeResult>()
    gateway.exchangeCode.mockReturnValueOnce(exchange.promise)

    const submitting = service.submitCode(VALID_CODE)
    service.stepBack()
    exchange.resolve({ ok: true, apiKey: API_KEY })
    await submitting

    expect(store.get().phase).toBe('awaiting-code')
    expect(credentials.save).not.toHaveBeenCalled()
    expect(gateway.revokeKey).toHaveBeenCalledExactlyOnceWith(API_KEY)
  })

  test('a failure after stepping back is dropped', async () => {
    const { service, store, gateway } = setup()
    await service.startConnection()
    const exchange = deferred<AuthExchangeResult>()
    gateway.exchangeCode.mockReturnValueOnce(exchange.promise)

    const submitting = service.submitCode('1111')
    service.stepBack()
    exchange.resolve({ ok: false, failure: 'invalid-code' })
    await submitting

    expect(store.get().phase).toBe('awaiting-code')
    expect(gateway.revokeKey).not.toHaveBeenCalled()
  })

  test("a superseded attempt's result never overrides the current one", async () => {
    const { service, store, gateway } = setup()
    await service.startConnection()
    const firstExchange = deferred<AuthExchangeResult>()
    const secondExchange = deferred<AuthExchangeResult>()
    gateway.exchangeCode
      .mockReturnValueOnce(firstExchange.promise)
      .mockReturnValueOnce(secondExchange.promise)

    const first = service.submitCode(VALID_CODE)
    service.stepBack()
    const second = service.submitCode('1111')
    secondExchange.resolve({ ok: false, failure: 'invalid-code' })
    await second
    firstExchange.resolve({ ok: true, apiKey: API_KEY })
    await first

    expect(store.get()).toMatchObject({ phase: 'failed', failure: 'invalid-code' })
    expect(gateway.revokeKey).toHaveBeenCalledExactlyOnceWith(API_KEY)
  })

  test('stepping back while the key is being saved un-stores and revokes it', async () => {
    const { service, store, gateway, credentials, stored } = setup()
    await service.startConnection()
    const saving = deferred<void>()
    credentials.save.mockImplementationOnce(async () => saving.promise)

    const submitting = service.submitCode(VALID_CODE)
    await vi.waitFor(() => expect(credentials.save).toHaveBeenCalled())
    service.stepBack()
    saving.resolve()
    await submitting

    expect(store.get().phase).toBe('awaiting-code')
    expect(stored()).toBeNull()
    expect(credentials.clear).toHaveBeenCalledOnce()
    expect(gateway.revokeKey).toHaveBeenCalledExactlyOnceWith(API_KEY)
  })
})

describe('signOut', () => {
  test('forgets the key locally without revoking it in Anytype', async () => {
    const { service, store, gateway, stored } = await connected()
    await service.signOut()

    expect(store.get()).toEqual({ phase: 'signed-out' })
    expect(stored()).toBeNull()
    expect(gateway.revokeKey).not.toHaveBeenCalled()
  })
})

describe('copyKeyTo', () => {
  test('hands the stored key to the sink', async () => {
    const { service } = await connected()
    const write = vi.fn()

    await expect(service.copyKeyTo(write)).resolves.toBe(true)
    expect(write).toHaveBeenCalledExactlyOnceWith(API_KEY)
  })

  test('writes nothing when no key is stored', async () => {
    const { service } = setup()
    const write = vi.fn()

    await expect(service.copyKeyTo(write)).resolves.toBe(false)
    expect(write).not.toHaveBeenCalled()
  })
})

describe('revoke', () => {
  test('revokes the stored key in Anytype, then signs out', async () => {
    const { service, store, gateway, stored } = await connected()
    await service.revoke()

    expect(gateway.revokeKey).toHaveBeenCalledExactlyOnceWith(API_KEY)
    expect(store.get()).toEqual({ phase: 'signed-out' })
    expect(stored()).toBeNull()
  })

  test('signs out without calling Anytype when no key is stored', async () => {
    const { service, store, gateway } = setup()
    store.set({ phase: 'connected', key: { hint: '4c19', issuedAt: 0 } })
    await service.revoke()

    expect(gateway.revokeKey).not.toHaveBeenCalled()
    expect(store.get()).toEqual({ phase: 'signed-out' })
  })

  test('stays connected, key kept, when Anytype cannot be reached', async () => {
    const { service, store, gateway, stored } = await connected()
    gateway.revokeKey.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    await expect(service.revoke()).rejects.toThrow('ECONNREFUSED')
    expect(store.get().phase).toBe('connected')
    expect(stored()).toEqual(expect.objectContaining({ apiKey: API_KEY }))
  })
})
