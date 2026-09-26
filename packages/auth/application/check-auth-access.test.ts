import { describe, expect, test, vi } from 'vitest'
import type {
  AuthAccess,
  AuthCredential,
  AuthGateway,
  AuthSession,
  AuthVerifyResult,
  CredentialRepository
} from '../domain'
import { CheckAuthAccess } from './check-auth-access'
import { AuthSessionStore } from './session-store'

const API_KEY = 'ak_secret_4c19'
const KEY = { hint: '4c19', issuedAt: 42 }
const GRANTED: AuthAccess = {
  apiVersion: 'v2',
  grant: { allSpaces: false, spaceIds: ['sp_1'], permission: 'read' }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function setup(
  initial: AuthSession = { phase: 'connected', key: KEY, access: null },
  credential: AuthCredential | null = { apiKey: API_KEY, issuedAt: 42 }
) {
  const gateway = {
    createChallenge: vi.fn<AuthGateway['createChallenge']>(),
    exchangeCode: vi.fn<AuthGateway['exchangeCode']>(),
    verifyApiKey: vi.fn<AuthGateway['verifyApiKey']>(async () => ({ ok: true, access: GRANTED }))
  }
  const credentials = {
    load: vi.fn<CredentialRepository['load']>(async () => credential),
    save: vi.fn<CredentialRepository['save']>(),
    clear: vi.fn<CredentialRepository['clear']>()
  }
  const store = new AuthSessionStore(initial)
  return { store, gateway, checkAuthAccess: new CheckAuthAccess({ gateway, credentials, store }) }
}

describe('CheckAuthAccess', () => {
  test('fills in what a restored key reaches', async () => {
    const { store, gateway, checkAuthAccess } = setup()
    await checkAuthAccess.execute()
    expect(gateway.verifyApiKey).toHaveBeenCalledExactlyOnceWith(API_KEY)
    expect(store.get()).toEqual({ phase: 'connected', key: KEY, access: GRANTED })
  })

  test('asks nothing while not connected', async () => {
    const { store, gateway, checkAuthAccess } = setup({ phase: 'signed-out' })
    await checkAuthAccess.execute()
    expect(gateway.verifyApiKey).not.toHaveBeenCalled()
    expect(store.get()).toEqual({ phase: 'signed-out' })
  })

  test('changes nothing when the key is refused, or Anytype cannot be reached', async () => {
    const { store, gateway, checkAuthAccess } = setup()
    const before = store.get()
    gateway.verifyApiKey.mockResolvedValueOnce({ ok: false, failure: 'invalid-key' })
    await checkAuthAccess.execute()
    gateway.verifyApiKey.mockRejectedValueOnce(new TypeError('fetch failed'))
    await checkAuthAccess.execute()
    expect(store.get()).toBe(before)
  })

  test('drops an answer that arrives after signing out', async () => {
    const { store, gateway, checkAuthAccess } = setup()
    const verify = deferred<AuthVerifyResult>()
    gateway.verifyApiKey.mockReturnValueOnce(verify.promise)
    const running = checkAuthAccess.execute()
    await vi.waitFor(() => expect(gateway.verifyApiKey).toHaveBeenCalled())
    store.set({ phase: 'signed-out' })
    verify.resolve({ ok: true, access: GRANTED })
    await running
    expect(store.get()).toEqual({ phase: 'signed-out' })
  })

  test('drops an answer about another key connected meanwhile', async () => {
    const { store, gateway, checkAuthAccess } = setup()
    const verify = deferred<AuthVerifyResult>()
    gateway.verifyApiKey.mockReturnValueOnce(verify.promise)
    const running = checkAuthAccess.execute()
    await vi.waitFor(() => expect(gateway.verifyApiKey).toHaveBeenCalled())
    const other: AuthSession = { phase: 'connected', key: { hint: 'ffff', issuedAt: 99 }, access: null }
    store.set(other)
    verify.resolve({ ok: true, access: GRANTED })
    await running
    expect(store.get()).toBe(other)
  })

  test('applies the answer of a check that overlapped another', async () => {
    const { store, gateway, checkAuthAccess } = setup()
    const first = deferred<AuthVerifyResult>()
    const second = deferred<AuthVerifyResult>()
    gateway.verifyApiKey.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const runs = [checkAuthAccess.execute(), checkAuthAccess.execute()]
    await vi.waitFor(() => expect(gateway.verifyApiKey).toHaveBeenCalledTimes(2))
    first.resolve({ ok: true, access: { apiVersion: 'v2', grant: null } })
    second.resolve({ ok: true, access: GRANTED })
    await Promise.all(runs)
    expect(store.get()).toEqual({ phase: 'connected', key: KEY, access: GRANTED })
  })
})
