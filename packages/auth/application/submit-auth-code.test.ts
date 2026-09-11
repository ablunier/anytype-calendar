import { describe, expect, test, vi } from 'vitest'
import {
  AUTH_CHALLENGE_LIFETIME_MS,
  type AuthCredential,
  type AuthExchangeResult,
  type AuthGateway,
  type CredentialRepository
} from '../domain'
import { AuthSessionStore } from './session-store'
import { StartAuthConnection } from './start-auth-connection'
import { StepBackAuthConnection } from './step-back-auth-connection'
import { SubmitAuthCode } from './submit-auth-code'

const VALID_CODE = '2749'
const API_KEY = 'ak_secret_4c19'
const START = 1_000

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function setup(initialCredential: AuthCredential | null = null) {
  let time = START
  let credential = initialCredential

  const gateway = {
    createChallenge: vi.fn<AuthGateway['createChallenge']>(async () => 'ch_1'),
    exchangeCode: vi.fn<AuthGateway['exchangeCode']>(async (_challengeId, code) =>
      code === VALID_CODE ? { ok: true, apiKey: API_KEY } : { ok: false, failure: 'invalid-code' }
    )
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
  const startAuthConnection = new StartAuthConnection({
    gateway,
    store,
    appName: 'Test app',
    now: () => time
  })
  const submitAuthCode = new SubmitAuthCode({ gateway, credentials, store, now: () => time })
  const stepBackAuthConnection = new StepBackAuthConnection(store)

  return {
    startAuthConnection,
    submitAuthCode,
    stepBackAuthConnection,
    store,
    gateway,
    credentials,
    stored: () => credential,
    advance: (ms: number) => {
      time += ms
    }
  }
}

describe('submitCode', () => {
  test('connects with the right code, storing the credential and exposing only its hint', async () => {
    const { startAuthConnection, submitAuthCode, store, gateway, stored, advance } = setup()
    await startAuthConnection.execute()
    advance(5_000)
    await submitAuthCode.execute(VALID_CODE)

    expect(gateway.exchangeCode).toHaveBeenCalledExactlyOnceWith('ch_1', VALID_CODE)
    expect(stored()).toEqual({ apiKey: API_KEY, issuedAt: START + 5_000 })
    expect(store.get()).toEqual({
      phase: 'connected',
      key: { hint: '4c19', issuedAt: START + 5_000 }
    })
    expect(JSON.stringify(store.get())).not.toContain(API_KEY)
  })

  test('is verifying while the exchange is in flight', async () => {
    const { startAuthConnection, submitAuthCode, store, gateway } = setup()
    await startAuthConnection.execute()
    const exchange = deferred<AuthExchangeResult>()
    gateway.exchangeCode.mockReturnValueOnce(exchange.promise)

    const submitting = submitAuthCode.execute(VALID_CODE)
    expect(store.get().phase).toBe('verifying')

    exchange.resolve({ ok: true, apiKey: API_KEY })
    await submitting
    expect(store.get().phase).toBe('connected')
  })

  test('fails with the attempt kept when Anytype rejects the code', async () => {
    const { startAuthConnection, submitAuthCode, store, stored } = setup()
    await startAuthConnection.execute()
    await submitAuthCode.execute('1111')

    expect(store.get()).toEqual({
      phase: 'failed',
      failure: 'invalid-code',
      attempt: { challenge: expect.objectContaining({ id: 'ch_1' }), code: '1111' }
    })
    expect(stored()).toBeNull()
  })

  test('fails as expired without asking Anytype once the challenge has lapsed', async () => {
    const { startAuthConnection, submitAuthCode, store, gateway, advance } = setup()
    await startAuthConnection.execute()
    advance(AUTH_CHALLENGE_LIFETIME_MS)
    await submitAuthCode.execute(VALID_CODE)

    expect(store.get()).toMatchObject({ phase: 'failed', failure: 'expired' })
    expect(gateway.exchangeCode).not.toHaveBeenCalled()
  })

  test('ignores a malformed code', async () => {
    const { startAuthConnection, submitAuthCode, store, gateway } = setup()
    await startAuthConnection.execute()
    const before = store.get()
    await submitAuthCode.execute('27')

    expect(store.get()).toBe(before)
    expect(gateway.exchangeCode).not.toHaveBeenCalled()
  })

  test('fails as unreachable when the exchange cannot reach Anytype', async () => {
    const { startAuthConnection, submitAuthCode, store, gateway } = setup()
    await startAuthConnection.execute()
    gateway.exchangeCode.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    await submitAuthCode.execute(VALID_CODE)

    expect(store.get()).toMatchObject({ phase: 'failed', failure: 'unreachable' })
  })

  test('a repeated submit does not start a second exchange or void the first', async () => {
    const { startAuthConnection, submitAuthCode, store, gateway } = setup()
    await startAuthConnection.execute()
    const exchange = deferred<AuthExchangeResult>()
    gateway.exchangeCode.mockReturnValueOnce(exchange.promise)

    const first = submitAuthCode.execute(VALID_CODE)
    const second = submitAuthCode.execute(VALID_CODE)
    exchange.resolve({ ok: true, apiKey: API_KEY })
    await Promise.all([first, second])

    expect(gateway.exchangeCode).toHaveBeenCalledOnce()
    expect(store.get().phase).toBe('connected')
  })
})

describe('late exchange results', () => {
  test('a success after stepping back is never stored', async () => {
    const { startAuthConnection, submitAuthCode, stepBackAuthConnection, store, gateway, credentials } =
      setup()
    await startAuthConnection.execute()
    const exchange = deferred<AuthExchangeResult>()
    gateway.exchangeCode.mockReturnValueOnce(exchange.promise)

    const submitting = submitAuthCode.execute(VALID_CODE)
    stepBackAuthConnection.execute()
    exchange.resolve({ ok: true, apiKey: API_KEY })
    await submitting

    expect(store.get().phase).toBe('awaiting-code')
    expect(credentials.save).not.toHaveBeenCalled()
  })

  test('a failure after stepping back is dropped', async () => {
    const { startAuthConnection, submitAuthCode, stepBackAuthConnection, store, gateway } = setup()
    await startAuthConnection.execute()
    const exchange = deferred<AuthExchangeResult>()
    gateway.exchangeCode.mockReturnValueOnce(exchange.promise)

    const submitting = submitAuthCode.execute('1111')
    stepBackAuthConnection.execute()
    exchange.resolve({ ok: false, failure: 'invalid-code' })
    await submitting

    expect(store.get().phase).toBe('awaiting-code')
  })

  test("a superseded attempt's result never overrides the current one", async () => {
    const { startAuthConnection, submitAuthCode, stepBackAuthConnection, store, gateway } = setup()
    await startAuthConnection.execute()
    const firstExchange = deferred<AuthExchangeResult>()
    const secondExchange = deferred<AuthExchangeResult>()
    gateway.exchangeCode
      .mockReturnValueOnce(firstExchange.promise)
      .mockReturnValueOnce(secondExchange.promise)

    const first = submitAuthCode.execute(VALID_CODE)
    stepBackAuthConnection.execute()
    const second = submitAuthCode.execute('1111')
    secondExchange.resolve({ ok: false, failure: 'invalid-code' })
    await second
    firstExchange.resolve({ ok: true, apiKey: API_KEY })
    await first

    expect(store.get()).toMatchObject({ phase: 'failed', failure: 'invalid-code' })
  })

  test('stepping back while the key is being saved un-stores it', async () => {
    const { startAuthConnection, submitAuthCode, stepBackAuthConnection, store, credentials, stored } =
      setup()
    await startAuthConnection.execute()
    const saving = deferred<void>()
    credentials.save.mockImplementationOnce(async () => saving.promise)

    const submitting = submitAuthCode.execute(VALID_CODE)
    await vi.waitFor(() => expect(credentials.save).toHaveBeenCalled())
    stepBackAuthConnection.execute()
    saving.resolve()
    await submitting

    expect(store.get().phase).toBe('awaiting-code')
    expect(stored()).toBeNull()
    expect(credentials.clear).toHaveBeenCalledOnce()
  })
})
