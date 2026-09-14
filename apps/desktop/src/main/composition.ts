import { randomBytes } from 'crypto'
import { join } from 'path'
import { setTimeout as sleep } from 'timers/promises'
import { app, safeStorage } from 'electron'
import { AnytypeClient } from '@anytype-calendar/anytype-client/infrastructure'
import {
  AuthSessionStore,
  CopyAuthApiKey,
  RestoreAuthSession,
  SignOutOfAuth,
  StartAuthConnection,
  StepBackAuthConnection,
  SubmitAuthCode
} from '@anytype-calendar/auth/application'
import type { AuthGateway, CredentialRepository } from '@anytype-calendar/auth/domain'
import {
  AnytypeAuthGateway,
  EncryptedFileCredentialRepository,
  InMemoryAuthGateway,
  InMemoryCredentialRepository
} from '@anytype-calendar/auth/infrastructure'
import {
  EventsMonthStore,
  LoadEventsMonth,
  ResetEventsMonth
} from '@anytype-calendar/events/application'
import type { EventsGateway, EventsTimeZone } from '@anytype-calendar/events/domain'
import {
  AnytypeEventsGateway,
  InMemoryEventsGateway,
  LocalEventsTimeZone
} from '@anytype-calendar/events/infrastructure'
import {
  LoadSchemaSelection,
  ResetSchemaSync,
  SaveSchemaSelection,
  SchemaSelectionStore,
  SchemaSyncStore,
  SyncSchema
} from '@anytype-calendar/schema/application'
import type { SchemaGateway } from '@anytype-calendar/schema/domain'
import {
  AnytypeSchemaGateway,
  InMemorySchemaGateway,
  JsonFileSchemaSelectionRepository
} from '@anytype-calendar/schema/infrastructure'
import { credentialFileAt, safeStorageCipher } from './auth/credential-storage'
import { eventsSourcesFor } from './events/event-sources'
import { selectionFileAt } from './schema/selection-storage'

/**
 * A closed Anytype refuses the connection at once; this bounds one that accepts it and
 * never answers, which would otherwise leave the UI verifying forever.
 */
const ANYTYPE_REQUEST_TIMEOUT_MS = 10_000

export interface AppServices {
  authSession: AuthSessionStore
  restoreAuthSession: RestoreAuthSession
  startAuthConnection: StartAuthConnection
  submitAuthCode: SubmitAuthCode
  stepBackAuthConnection: StepBackAuthConnection
  signOutOfAuth: SignOutOfAuth
  copyAuthApiKey: CopyAuthApiKey
  schemaSync: SyncSchema
  schemaState: SchemaSyncStore
  schemaSelection: SchemaSelectionStore
  loadSchemaSelection: LoadSchemaSelection
  saveSchemaSelection: SaveSchemaSelection
  eventsState: EventsMonthStore
  loadEventsMonth: LoadEventsMonth
}

/** The only place adapters are chosen. Call it once the app is ready: safeStorage needs that. */
export function composeServices(): AppServices {
  // Swaps all of Anytype for a simulation: sign-in accepts 2749 (each challenge is logged
  // here), and the schema and object reads return the design's sample account.
  const fakeAnytype = process.env['ANYTYPE_CALENDAR_FAKE_AUTH'] === '1'
  const client = fakeAnytype ? null : anytypeClient()

  // A fake key gets its own file, so it is never restored against the real Anytype.
  const credentials = credentialRepository(fakeAnytype ? 'credential-fake.bin' : 'credential.bin')

  const authSession = new AuthSessionStore()
  const authGateway = client ? new AnytypeAuthGateway(client) : inMemoryAuthGateway()
  const restoreAuthSession = new RestoreAuthSession({ credentials, store: authSession })
  const startAuthConnection = new StartAuthConnection({
    gateway: authGateway,
    store: authSession,
    appName: 'Calendar for Anytype'
  })
  const submitAuthCode = new SubmitAuthCode({ gateway: authGateway, credentials, store: authSession })
  const stepBackAuthConnection = new StepBackAuthConnection(authSession)
  const signOutOfAuth = new SignOutOfAuth({ credentials, store: authSession })
  const copyAuthApiKey = new CopyAuthApiKey(credentials)

  // Adapts auth's credentials to the key source port schema and events each declare.
  const apiKeys = { current: async () => (await credentials.load())?.apiKey ?? null }

  const schemaState = new SchemaSyncStore()
  const schemaSync = new SyncSchema({
    gateway: client ? new AnytypeSchemaGateway(client) : inMemorySchemaGateway(),
    apiKeys,
    store: schemaState
  })
  const resetSchemaSync = new ResetSchemaSync(schemaState)

  // The fake account's space ids are not the real one's, so its choices get their own file.
  const selectionRepository = new JsonFileSchemaSelectionRepository(
    selectionFileAt(
      join(
        app.getPath('userData'),
        fakeAnytype ? 'schema-selection-fake.json' : 'schema-selection.json'
      )
    )
  )
  const schemaSelection = new SchemaSelectionStore()
  const loadSchemaSelection = new LoadSchemaSelection({
    repository: selectionRepository,
    store: schemaSelection
  })
  const saveSchemaSelection = new SaveSchemaSelection({
    repository: selectionRepository,
    store: schemaSelection
  })

  const zone = new LocalEventsTimeZone()
  const eventsState = new EventsMonthStore()
  const loadEventsMonth = new LoadEventsMonth({
    gateway: client ? new AnytypeEventsGateway(client) : inMemoryEventsGateway(zone),
    apiKeys,
    sources: { current: () => eventsSourcesFor(schemaSelection.get()) },
    zone,
    store: eventsState
  })
  const resetEventsMonth = new ResetEventsMonth(eventsState)

  // Contexts never know about each other, so the links live here. Being connected — signed
  // in just now, or a key restored at launch — is what reads the account and the month;
  // anything else forgets both. The stores notify only on change, and a reset while idle is
  // a no-op.
  const connected = (): boolean => authSession.get().phase === 'connected'
  authSession.subscribe((session) => {
    if (session.phase === 'connected') {
      void schemaSync.execute()
      void loadEventsMonth.execute()
    } else {
      resetSchemaSync.execute()
      resetEventsMonth.execute()
    }
  })
  // A fresh read of the account, or a changed selection, may change what the month holds. A
  // reload replaces a load still running, so a burst of Settings changes draws only the last.
  schemaState.subscribe((state) => {
    if (state.phase === 'synced' && connected()) void loadEventsMonth.execute()
  })
  schemaSelection.subscribe(() => {
    if (connected()) void loadEventsMonth.execute()
  })

  return {
    authSession,
    restoreAuthSession,
    startAuthConnection,
    submitAuthCode,
    stepBackAuthConnection,
    signOutOfAuth,
    copyAuthApiKey,
    schemaSync,
    schemaState,
    schemaSelection,
    loadSchemaSelection,
    saveSchemaSelection,
    eventsState,
    loadEventsMonth
  }
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

function inMemoryEventsGateway(zone: EventsTimeZone): EventsGateway {
  return new InMemoryEventsGateway({ sleep: (ms) => sleep(ms), zone, now: Date.now })
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
