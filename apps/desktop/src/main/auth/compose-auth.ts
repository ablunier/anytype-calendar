import { randomBytes } from 'crypto'
import { join } from 'path'
import { setTimeout as sleep } from 'timers/promises'
import { app, safeStorage } from 'electron'
import {
  AuthSessionStore,
  CheckAuthAccess,
  CopyAuthApiKey,
  RestoreAuthSession,
  SignOutOfAuth,
  StartAuthConnection,
  StartAuthKeyEntry,
  StepBackAuthConnection,
  SubmitAuthApiKey,
  SubmitAuthCode
} from '@anytype-calendar/auth/application'
import type { AuthGateway, CredentialRepository } from '@anytype-calendar/auth/domain'
import {
  AnytypeAuthGateway,
  EncryptedFileCredentialRepository,
  InMemoryAuthGateway,
  InMemoryCredentialRepository
} from '@anytype-calendar/auth/infrastructure'
import type { Anytype } from '../anytype/compose-anytype'
import { credentialFileAt, safeStorageCipher } from './credential-storage'

export type Auth = ReturnType<typeof composeAuth>

export function composeAuth(anytype: Anytype) {
  // A fake key gets its own file, so it is never restored against the real Anytype.
  const credentials = credentialRepository(anytype.kind === 'fake' ? 'credential-fake.bin' : 'credential.bin')
  const gateway = anytype.kind === 'real' ? new AnytypeAuthGateway(anytype.client) : inMemoryAuthGateway()
  const authSession = new AuthSessionStore()
  return {
    authSession,
    restoreAuthSession: new RestoreAuthSession({ credentials, store: authSession }),
    checkAuthAccess: new CheckAuthAccess({ gateway, credentials, store: authSession }),
    startAuthConnection: new StartAuthConnection({
      gateway,
      store: authSession,
      appName: 'Calendar for Anytype'
    }),
    submitAuthCode: new SubmitAuthCode({ gateway, credentials, store: authSession }),
    startAuthKeyEntry: new StartAuthKeyEntry(authSession),
    submitAuthApiKey: new SubmitAuthApiKey({ gateway, credentials, store: authSession }),
    stepBackAuthConnection: new StepBackAuthConnection(authSession),
    signOutOfAuth: new SignOutOfAuth({ credentials, store: authSession }),
    copyAuthApiKey: new CopyAuthApiKey(credentials),
    // Adapts the credentials to the key source port schema and events each declare.
    apiKeys: { current: async () => (await credentials.load())?.apiKey ?? null }
  }
}

function inMemoryAuthGateway(): AuthGateway {
  return new InMemoryAuthGateway({
    sleep: (ms) => sleep(ms),
    log: (message) => console.info(message),
    randomId: () => randomBytes(3).toString('hex')
  })
}

/** Never writes the key in plaintext: without OS encryption it lasts only until quit. */
function credentialRepository(fileName: string): CredentialRepository {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[auth] OS encryption is unavailable; the API key will not survive a restart')
    return new InMemoryCredentialRepository()
  }
  // Without a keyring Linux falls back to a hardcoded password — obfuscation, not
  // encryption. Kept anyway, by choice, so the key still survives restarts there.
  if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
    console.warn('[auth] No keyring found; the API key is stored obfuscated, not encrypted')
  }
  return new EncryptedFileCredentialRepository({
    cipher: safeStorageCipher,
    file: credentialFileAt(join(app.getPath('userData'), fileName))
  })
}
