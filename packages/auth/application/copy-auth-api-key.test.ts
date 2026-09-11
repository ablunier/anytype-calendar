import { describe, expect, test, vi } from 'vitest'
import type { AuthCredential, AuthGateway, CredentialRepository } from '../domain'
import { CopyAuthApiKey } from './copy-auth-api-key'
import { AuthSessionStore } from './session-store'
import { StartAuthConnection } from './start-auth-connection'
import { SubmitAuthCode } from './submit-auth-code'

const VALID_CODE = '2749'
const API_KEY = 'ak_secret_4c19'

function setup(initialCredential: AuthCredential | null = null) {
  let credential = initialCredential

  const gateway = {
    createChallenge: vi.fn<AuthGateway['createChallenge']>(async () => 'ch_1'),
    exchangeCode: vi.fn<AuthGateway['exchangeCode']>(async () => ({ ok: true, apiKey: API_KEY }))
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
  const startAuthConnection = new StartAuthConnection({ gateway, store, appName: 'Test app' })
  const submitAuthCode = new SubmitAuthCode({ gateway, credentials, store })
  const copyAuthApiKey = new CopyAuthApiKey(credentials)

  return { startAuthConnection, submitAuthCode, copyAuthApiKey }
}

async function connected() {
  const harness = setup()
  await harness.startAuthConnection.execute()
  await harness.submitAuthCode.execute(VALID_CODE)
  return harness
}

describe('copyKeyTo', () => {
  test('hands the stored key to the sink', async () => {
    const { copyAuthApiKey } = await connected()
    const write = vi.fn()

    await expect(copyAuthApiKey.execute(write)).resolves.toBe(true)
    expect(write).toHaveBeenCalledExactlyOnceWith(API_KEY)
  })

  test('writes nothing when no key is stored', async () => {
    const { copyAuthApiKey } = setup()
    const write = vi.fn()

    await expect(copyAuthApiKey.execute(write)).resolves.toBe(false)
    expect(write).not.toHaveBeenCalled()
  })
})
