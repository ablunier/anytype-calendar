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
import { ResetSchemaSync, SchemaSyncStore, SyncSchema } from '@anytype-calendar/schema/application'
import type { SchemaGateway } from '@anytype-calendar/schema/domain'
import {
  AnytypeSchemaGateway,
  InMemorySchemaGateway
} from '@anytype-calendar/schema/infrastructure'
import { credentialFileAt, safeStorageCipher } from './auth/credential-storage'

/**
 * A closed Anytype refuses the connection at once; this bounds one that accepts it and
 * never answers, which would otherwise leave the UI verifying forever.
 */
const ANYTYPE_REQUEST_TIMEOUT_MS = 10_000

export interface AppServices {
  authService: AuthService
  authSession: AuthSessionStore
  schemaSync: SyncSchema
  schemaState: SchemaSyncStore
}

/** The only place adapters are chosen. Call it once the app is ready: safeStorage needs that. */
export function composeServices(): AppServices {
  // Swaps all of Anytype for a simulation: sign-in accepts 2749 (each challenge is logged
  // here), and the schema reads return the design's sample account.
  const fakeAnytype = process.env['ANYTYPE_CALENDAR_FAKE_AUTH'] === '1'
  const client = fakeAnytype ? null : anytypeClient()

  // A fake key gets its own file, so it is never restored against the real Anytype.
  const credentials = credentialRepository(fakeAnytype ? 'credential-fake.bin' : 'credential.bin')

  const authSession = new AuthSessionStore()
  const authService = new AuthService({
    gateway: client ? new AnytypeAuthGateway(client) : inMemoryAuthGateway(),
    credentials,
    store: authSession,
    appName: 'Calendar for Anytype'
  })

  const schemaState = new SchemaSyncStore()
  const schemaSync = new SyncSchema({
    gateway: client ? new AnytypeSchemaGateway(client) : inMemorySchemaGateway(),
    apiKeys: { current: async () => (await credentials.load())?.apiKey ?? null },
    store: schemaState
  })
  const resetSchemaSync = new ResetSchemaSync(schemaState)

  // Contexts never know about each other, so the link lives here: being connected — signed
  // in just now, or a key restored at launch — is what reads the account; anything else
  // forgets it. The session store notifies only on change, and a reset while idle is a no-op.
  authSession.subscribe((session) => {
    if (session.phase === 'connected') void schemaSync.execute()
    else resetSchemaSync.execute()
  })

  return { authService, authSession, schemaSync, schemaState }
}

function anytypeClient(): AnytypeClient {
  return new AnytypeClient({
    fetch: (url, init) =>
      fetch(url, { ...init, signal: AbortSignal.timeout(ANYTYPE_REQUEST_TIMEOUT_MS) })
  })
}

function inMemoryAuthGateway(): AuthGateway {
  return new InMemoryAuthGateway({
    sleep: (ms) => sleep(ms),
    log: (message) => console.info(message),
    randomId: () => randomBytes(3).toString('hex')
  })
}

function inMemorySchemaGateway(): SchemaGateway {
  return new InMemorySchemaGateway({ sleep: (ms) => sleep(ms) })
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
