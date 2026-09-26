import { describe, expect, test, vi } from 'vitest'
import type { AuthGateway, AuthVerifyResult, CredentialRepository } from '../domain'
import { AuthSessionStore } from './session-store'
import { StartAuthKeyEntry } from './start-auth-key-entry'
import { StepBackAuthConnection } from './step-back-auth-connection'
import { SubmitAuthApiKey } from './submit-auth-api-key'

const VALID_KEY = 'ak_secret_4c19'
const START = 1_000
const ACCESS = { apiVersion: 'v2', grant: null } as const

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function setup(initialCredential: { apiKey: string; issuedAt: number } | null = null) {
  let time = START
  let credential = initialCredential

  const gateway = {
    createChallenge: vi.fn<AuthGateway['createChallenge']>(async () => 'ch_1'),
    exchangeCode: vi.fn<AuthGateway['exchangeCode']>(async () => ({
      ok: false,
      failure: 'invalid-code'
    })),
    verifyApiKey: vi.fn<AuthGateway['verifyApiKey']>(async (apiKey) =>
      apiKey === VALID_KEY ? { ok: true, access: ACCESS } : { ok: false, failure: 'invalid-key' }
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
  const startAuthKeyEntry = new StartAuthKeyEntry(store)
  const submitAuthApiKey = new SubmitAuthApiKey({ gateway, credentials, store, now: () => time })
  const stepBackAuthConnection = new StepBackAuthConnection(store)

  return {
    startAuthKeyEntry,
    submitAuthApiKey,
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

describe('submitApiKey', () => {
  test('connects with a valid key, storing the credential and exposing only its hint', async () => {
    const { startAuthKeyEntry, submitAuthApiKey, store, gateway, stored, advance } = setup()
    startAuthKeyEntry.execute()
    advance(5_000)
    await submitAuthApiKey.execute(VALID_KEY)

    expect(gateway.verifyApiKey).toHaveBeenCalledExactlyOnceWith(VALID_KEY)
    expect(stored()).toEqual({ apiKey: VALID_KEY, issuedAt: START + 5_000 })
    expect(store.get()).toEqual({
      phase: 'connected',
      key: { hint: '4c19', issuedAt: START + 5_000 },
      access: ACCESS
    })
    expect(JSON.stringify(store.get())).not.toContain(VALID_KEY)
  })

  test('is verifying while the check is in flight', async () => {
    const { startAuthKeyEntry, submitAuthApiKey, store, gateway } = setup()
    startAuthKeyEntry.execute()
    const verify = deferred<AuthVerifyResult>()
    gateway.verifyApiKey.mockReturnValueOnce(verify.promise)

    const submitting = submitAuthApiKey.execute(VALID_KEY)
    expect(store.get().phase).toBe('verifying-key')

    verify.resolve({ ok: true, access: ACCESS })
    await submitting
    expect(store.get().phase).toBe('connected')
  })

  test('fails, marked as entered by key, when Anytype rejects the key', async () => {
    const { startAuthKeyEntry, submitAuthApiKey, store, stored } = setup()
    startAuthKeyEntry.execute()
    await submitAuthApiKey.execute('ak_wrong')

    expect(store.get()).toEqual({ phase: 'failed', failure: 'invalid-key', enteredKey: true })
    expect(stored()).toBeNull()
  })

  test('fails as unreachable when the check cannot reach Anytype', async () => {
    const { startAuthKeyEntry, submitAuthApiKey, store, gateway } = setup()
    startAuthKeyEntry.execute()
    gateway.verifyApiKey.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    await submitAuthApiKey.execute(VALID_KEY)

    expect(store.get()).toEqual({ phase: 'failed', failure: 'unreachable', enteredKey: true })
  })

  test('a repeated submit does not start a second check or void the first', async () => {
    const { startAuthKeyEntry, submitAuthApiKey, store, gateway } = setup()
    startAuthKeyEntry.execute()
    const verify = deferred<AuthVerifyResult>()
    gateway.verifyApiKey.mockReturnValueOnce(verify.promise)

    const first = submitAuthApiKey.execute(VALID_KEY)
    const second = submitAuthApiKey.execute(VALID_KEY)
    verify.resolve({ ok: true, access: ACCESS })
    await Promise.all([first, second])

    expect(gateway.verifyApiKey).toHaveBeenCalledOnce()
    expect(store.get().phase).toBe('connected')
  })
})

describe('late verify results', () => {
  test('a success after stepping back is never stored', async () => {
    const {
      startAuthKeyEntry,
      submitAuthApiKey,
      stepBackAuthConnection,
      store,
      gateway,
      credentials
    } = setup()
    startAuthKeyEntry.execute()
    const verify = deferred<AuthVerifyResult>()
    gateway.verifyApiKey.mockReturnValueOnce(verify.promise)

    const submitting = submitAuthApiKey.execute(VALID_KEY)
    stepBackAuthConnection.execute()
    verify.resolve({ ok: true, access: ACCESS })
    await submitting

    expect(store.get().phase).toBe('entering-key')
    expect(credentials.save).not.toHaveBeenCalled()
  })

  test('a failure after stepping back is dropped', async () => {
    const { startAuthKeyEntry, submitAuthApiKey, stepBackAuthConnection, store, gateway } = setup()
    startAuthKeyEntry.execute()
    const verify = deferred<AuthVerifyResult>()
    gateway.verifyApiKey.mockReturnValueOnce(verify.promise)

    const submitting = submitAuthApiKey.execute('ak_wrong')
    stepBackAuthConnection.execute()
    verify.resolve({ ok: false, failure: 'invalid-key' })
    await submitting

    expect(store.get().phase).toBe('entering-key')
  })

  test('stepping back while the key is being saved un-stores it', async () => {
    const {
      startAuthKeyEntry,
      submitAuthApiKey,
      stepBackAuthConnection,
      store,
      credentials,
      stored
    } = setup()
    startAuthKeyEntry.execute()
    const saving = deferred<void>()
    credentials.save.mockImplementationOnce(async () => saving.promise)

    const submitting = submitAuthApiKey.execute(VALID_KEY)
    await vi.waitFor(() => expect(credentials.save).toHaveBeenCalled())
    stepBackAuthConnection.execute()
    saving.resolve()
    await submitting

    expect(store.get().phase).toBe('entering-key')
    expect(stored()).toBeNull()
    expect(credentials.clear).toHaveBeenCalledOnce()
  })
})
