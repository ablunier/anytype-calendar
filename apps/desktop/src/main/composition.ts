import { randomBytes } from 'crypto'
import { join } from 'path'
import { setTimeout as sleep } from 'timers/promises'
import { app, safeStorage } from 'electron'
import { AnytypeClient } from '@anytype-calendar/anytype-client/infrastructure'
import { AuthService, AuthSessionStore } from '@anytype-calendar/auth/application'
import type { AuthGateway, CredentialRepository } from '@anytype-calendar/auth/domain'
import {
  AnytypeAuthGateway,
  EncryptedFileCredentialRepository,
  InMemoryAuthGateway,
  InMemoryCredentialRepository
} from '@anytype-calendar/auth/infrastructure'
import { credentialFileAt, safeStorageCipher } from './auth/credential-storage'

/**
 * A closed Anytype refuses the connection at once; this bounds one that accepts it and
 * never answers, which would otherwise leave the UI verifying forever.
 */
const ANYTYPE_REQUEST_TIMEOUT_MS = 10_000

export interface AppServices {
  authService: AuthService
  authSession: AuthSessionStore
}

/** The only place adapters are chosen. Call it once the app is ready: safeStorage needs that. */
export function composeServices(): AppServices {
  // Signs in against a simulated Anytype that accepts 2749, logging each challenge here.
  const fakeAuth = process.env['ANYTYPE_CALENDAR_FAKE_AUTH'] === '1'

  const authSession = new AuthSessionStore()
  const authService = new AuthService({
    gateway: fakeAuth ? inMemoryAuthGateway() : anytypeAuthGateway(),
    // A fake key gets its own file, so it is never restored against the real Anytype.
    credentials: credentialRepository(fakeAuth ? 'credential-fake.bin' : 'credential.bin'),
    store: authSession,
    appName: 'Calendar for Anytype'
  })
  return { authService, authSession }
}

function anytypeAuthGateway(): AuthGateway {
  const client = new AnytypeClient({
    fetch: (url, init) =>
      fetch(url, { ...init, signal: AbortSignal.timeout(ANYTYPE_REQUEST_TIMEOUT_MS) })
  })
  return new AnytypeAuthGateway(client)
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
