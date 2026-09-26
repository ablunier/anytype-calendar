import { randomBytes } from 'crypto'
import { join } from 'path'
import { setTimeout as sleep } from 'timers/promises'
import { app, safeStorage } from 'electron'
import {
  AnytypeClient,
  AnytypeDialectProbe,
  type AnytypeDialect
} from '@anytype-calendar/anytype-client/infrastructure'
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
  AnytypeV1AuthGateway,
  AnytypeV2AuthGateway,
  EncryptedFileCredentialRepository,
  InMemoryAuthGateway,
  InMemoryCredentialRepository
} from '@anytype-calendar/auth/infrastructure'
import {
  EventsSpanStore,
  LoadEventsSpan,
  ResetEventsSpan
} from '@anytype-calendar/events/application'
import type { EventsGateway, EventsTimeZone } from '@anytype-calendar/events/domain'
import {
  AnytypeEventsGateway,
  AnytypeV1EventsGateway,
  AnytypeV2EventsGateway,
  InMemoryEventsGateway,
  LocalEventsTimeZone
} from '@anytype-calendar/events/infrastructure'
import {
  LoadSchemaSelection,
  RekeySchemaSelection,
  ResetSchemaSync,
  SaveSchemaSelection,
  SchemaSelectionStore,
  SchemaSyncStore,
  SyncSchema
} from '@anytype-calendar/schema/application'
import type { SchemaGateway } from '@anytype-calendar/schema/domain'
import {
  AnytypeSchemaGateway,
  AnytypeV1SchemaGateway,
  AnytypeV2SchemaGateway,
  InMemorySchemaGateway,
  JsonFileSchemaSelectionRepository
} from '@anytype-calendar/schema/infrastructure'
import { ApiVersionStore } from './api-version/api-version-store'
import { LoadApiVersion } from './api-version/load-api-version'
import { SaveApiVersion } from './api-version/save-api-version'
import { appConfigStore } from './app-config-file'
import { atomicFileAt } from './atomic-file'
import { credentialFileAt, safeStorageCipher } from './auth/credential-storage'
import { defaultEventsSpan } from './events/default-span'
import { eventsSourcesFor } from './events/event-sources'
import { LoadLanguage } from './language/load-language'
import { SaveLanguage } from './language/save-language'
import { LanguageStore } from './language/language-store'
import { selectionFileAt } from './schema/selection-storage'
import { LoadTheme } from './theme/load-theme'
import { SaveTheme } from './theme/save-theme'
import { ThemeStore } from './theme/theme-store'
import { LoadTimeFormat } from './time-format/load-time-format'
import { SaveTimeFormat } from './time-format/save-time-format'
import { TimeFormatStore } from './time-format/time-format-store'
import { CalendarViewStore } from './calendar-view/calendar-view-store'
import { LoadCalendarView } from './calendar-view/load-calendar-view'
import { SaveCalendarView } from './calendar-view/save-calendar-view'
import { LoadWeekStart } from './week-start/load-week-start'
import { SaveWeekStart } from './week-start/save-week-start'
import { WeekStartStore } from './week-start/week-start-store'
import { LoadWeekNumbers } from './week-numbers/load-week-numbers'
import { SaveWeekNumbers } from './week-numbers/save-week-numbers'
import { WeekNumbersStore } from './week-numbers/week-numbers-store'

/**
 * A closed Anytype refuses the connection at once; this bounds one that accepts it and
 * never answers, which would otherwise leave the UI verifying forever.
 */
const ANYTYPE_REQUEST_TIMEOUT_MS = 10_000

export interface AppServices {
  authSession: AuthSessionStore
  restoreAuthSession: RestoreAuthSession
  checkAuthAccess: CheckAuthAccess
  startAuthConnection: StartAuthConnection
  submitAuthCode: SubmitAuthCode
  startAuthKeyEntry: StartAuthKeyEntry
  submitAuthApiKey: SubmitAuthApiKey
  stepBackAuthConnection: StepBackAuthConnection
  signOutOfAuth: SignOutOfAuth
  copyAuthApiKey: CopyAuthApiKey
  schemaSync: SyncSchema
  schemaState: SchemaSyncStore
  schemaSelection: SchemaSelectionStore
  loadSchemaSelection: LoadSchemaSelection
  saveSchemaSelection: SaveSchemaSelection
  eventsState: EventsSpanStore
  loadEventsSpan: LoadEventsSpan
  themeState: ThemeStore
  loadTheme: LoadTheme
  saveTheme: SaveTheme
  languageState: LanguageStore
  loadLanguage: LoadLanguage
  saveLanguage: SaveLanguage
  weekNumbersState: WeekNumbersStore
  loadWeekNumbers: LoadWeekNumbers
  saveWeekNumbers: SaveWeekNumbers
  weekStartState: WeekStartStore
  loadWeekStart: LoadWeekStart
  saveWeekStart: SaveWeekStart
  calendarViewState: CalendarViewStore
  loadCalendarView: LoadCalendarView
  saveCalendarView: SaveCalendarView
  timeFormatState: TimeFormatStore
  loadTimeFormat: LoadTimeFormat
  saveTimeFormat: SaveTimeFormat
  apiVersionState: ApiVersionStore
  loadApiVersion: LoadApiVersion
  saveApiVersion: SaveApiVersion
}

/** The only place adapters are chosen. Call it once the app is ready: safeStorage needs that. */
export function composeServices(): AppServices {
  // Swaps all of Anytype for a simulation: sign-in accepts 2749 (each challenge is logged
  // here), or the API key ak_fake_2749 pasted directly, and the schema and object reads
  // return the design's sample account.
  const fakeAnytype = process.env['ANYTYPE_CALENDAR_FAKE_AUTH'] === '1'
  const client = fakeAnytype ? null : anytypeClient()
  // Every context asks this which major of the API Anytype serves: v2 where it can, v1 where
  // it cannot, unless Settings asks for v1 only. ANYTYPE_CALENDAR_API=v1 or v2 overrides that
  // setting, e.g. to force the fallback against an Anytype that has v2.
  const envDialect = dialectFromEnv()
  const probe = client
    ? new AnytypeDialectProbe(envDialect ? { client, forced: envDialect } : { client })
    : null

  // A fake key gets its own file, so it is never restored against the real Anytype.
  const credentials = credentialRepository(fakeAnytype ? 'credential-fake.bin' : 'credential.bin')

  const authSession = new AuthSessionStore()
  const authGateway =
    client && probe
      ? new AnytypeAuthGateway({
          probe,
          v1: new AnytypeV1AuthGateway(client),
          v2: new AnytypeV2AuthGateway(client)
        })
      : inMemoryAuthGateway()
  const restoreAuthSession = new RestoreAuthSession({ credentials, store: authSession })
  const checkAuthAccess = new CheckAuthAccess({ gateway: authGateway, credentials, store: authSession })
  const startAuthConnection = new StartAuthConnection({
    gateway: authGateway,
    store: authSession,
    appName: 'Calendar for Anytype'
  })
  const submitAuthCode = new SubmitAuthCode({ gateway: authGateway, credentials, store: authSession })
  const startAuthKeyEntry = new StartAuthKeyEntry(authSession)
  const submitAuthApiKey = new SubmitAuthApiKey({ gateway: authGateway, credentials, store: authSession })
  const stepBackAuthConnection = new StepBackAuthConnection(authSession)
  const signOutOfAuth = new SignOutOfAuth({ credentials, store: authSession })
  const copyAuthApiKey = new CopyAuthApiKey(credentials)

  // Adapts auth's credentials to the key source port schema and events each declare.
  const apiKeys = { current: async () => (await credentials.load())?.apiKey ?? null }

  const schemaState = new SchemaSyncStore()
  const schemaSync = new SyncSchema({
    gateway:
      client && probe
        ? new AnytypeSchemaGateway({
            probe,
            v1: new AnytypeV1SchemaGateway(client),
            v2: new AnytypeV2SchemaGateway({ client, probe })
          })
        : inMemorySchemaGateway(),
    apiKeys,
    store: schemaState
  })
  const resetSchemaSync = new ResetSchemaSync(schemaState)

  // One file holds every non-secret setting: the schema selection, the theme, and anything
  // added later. The fake account's ids are not the real one's, so it gets its own file,
  // like the credential.
  const appConfig = appConfigStore(
    atomicFileAt(
      join(app.getPath('userData'), fakeAnytype ? 'app-config-fake.json' : 'app-config.json'),
      0o644
    )
  )

  const selectionRepository = new JsonFileSchemaSelectionRepository(selectionFileAt(appConfig))
  const schemaSelection = new SchemaSelectionStore()
  const loadSchemaSelection = new LoadSchemaSelection({
    repository: selectionRepository,
    store: schemaSelection
  })
  const saveSchemaSelection = new SaveSchemaSelection({
    repository: selectionRepository,
    store: schemaSelection
  })
  const rekeySchemaSelection = new RekeySchemaSelection(saveSchemaSelection)

  const zone = new LocalEventsTimeZone()
  const eventsState = new EventsSpanStore()
  const loadEventsSpan = new LoadEventsSpan({
    gateway:
      client && probe
        ? new AnytypeEventsGateway({
            probe,
            v1: new AnytypeV1EventsGateway(client),
            v2: new AnytypeV2EventsGateway({ client, probe })
          })
        : inMemoryEventsGateway(zone),
    apiKeys,
    sources: { current: () => eventsSourcesFor(schemaSelection.get()) },
    zone,
    store: eventsState,
    // A launch opens on the view last chosen, so the first read is the one the window draws.
    defaultSpan: () =>
      defaultEventsSpan(calendarViewState.get(), zone.dayOf(Date.now()), weekStartState.get())
  })
  const resetEventsSpan = new ResetEventsSpan(eventsState)

  const themeState = new ThemeStore()
  const loadTheme = new LoadTheme({ config: appConfig, store: themeState })
  const saveTheme = new SaveTheme({ config: appConfig, store: themeState })

  const languageState = new LanguageStore()
  const loadLanguage = new LoadLanguage({ config: appConfig, store: languageState })
  const saveLanguage = new SaveLanguage({ config: appConfig, store: languageState })

  const weekNumbersState = new WeekNumbersStore()
  const loadWeekNumbers = new LoadWeekNumbers({ config: appConfig, store: weekNumbersState })
  const saveWeekNumbers = new SaveWeekNumbers({ config: appConfig, store: weekNumbersState })

  const weekStartState = new WeekStartStore()
  const loadWeekStart = new LoadWeekStart({ config: appConfig, store: weekStartState })
  const saveWeekStart = new SaveWeekStart({ config: appConfig, store: weekStartState })
  const calendarViewState = new CalendarViewStore()
  const loadCalendarView = new LoadCalendarView({ config: appConfig, store: calendarViewState })
  const saveCalendarView = new SaveCalendarView({ config: appConfig, store: calendarViewState })

  const timeFormatState = new TimeFormatStore()
  const loadTimeFormat = new LoadTimeFormat({ config: appConfig, store: timeFormatState })
  const saveTimeFormat = new SaveTimeFormat({ config: appConfig, store: timeFormatState })

  // The simulated Anytype has no second major to fall back to, so there it changes nothing.
  const apiVersionState = new ApiVersionStore()
  const loadApiVersion = new LoadApiVersion({ config: appConfig, store: apiVersionState })
  const saveApiVersion = new SaveApiVersion({ config: appConfig, store: apiVersionState })

  // Contexts never know about each other, so the links live here. Being connected — signed
  // in just now, or a key restored at launch — is what reads the account and the month;
  // anything else forgets both. The stores notify only on change, and a reset while idle is
  // a no-op.
  // Checking the key's access is what fills in a restored session's, and replaces the session
  // while it stays connected, which must not read everything again.
  const connected = (): boolean => authSession.get().phase === 'connected'
  let wasConnected = false
  authSession.subscribe((session) => {
    const isConnected = session.phase === 'connected'
    const entered = isConnected && !wasConnected
    wasConnected = isConnected
    if (entered) {
      if (session.access === null) void checkAuthAccess.execute()
      void schemaSync.execute()
      void loadEventsSpan.execute()
    } else if (!isConnected) {
      resetSchemaSync.execute()
      resetEventsSpan.execute()
      // Anytype may be updated before the next sign-in, and a key restored at launch has only
      // just been probed, so the dialect is asked again only once the session is left.
      probe?.forget()
    }
  })
  // A key Anytype no longer accepts — usually deleted in its settings — answers unauthorized
  // to every request from here on, so retrying it is pointless. Signing out clears it and
  // flips the session away from `connected`, which the line above already resets both stores
  // for, and which the renderer already reads as "show sign-in" — so a rejected key sends the
  // user back there instead of leaving them stuck on a screen that can never read anything.
  const handleUnauthorized = (failure: 'unreachable' | 'unauthorized'): void => {
    if (failure === 'unauthorized' && connected()) void signOutOfAuth.execute()
  }
  // A fresh read of the account, or a changed selection, may change what the month holds. A
  // reload replaces a load still running, so a burst of Settings changes draws only the last.
  // A selection saved under v1 of the API may name types and properties by keys v2 spells
  // otherwise; rewriting it saves it, and a saved selection reloads the span on its own.
  schemaState.subscribe((state) => {
    if (state.phase === 'synced') {
      rekeySchemaSelection.execute(state.last.spaces).catch((error: unknown) => {
        console.error('Could not rewrite the calendar selection to the current keys', error)
      })
    }
    if (state.phase === 'synced' && connected()) void loadEventsSpan.execute()
    if (state.phase === 'failed') handleUnauthorized(state.failure)
  })
  eventsState.subscribe((state) => {
    if (state.phase === 'failed') handleUnauthorized(state.failure)
  })
  schemaSelection.subscribe(() => {
    if (connected()) void loadEventsSpan.execute()
  })
  // Loaded before the session is restored, so the first read already goes through the saved
  // choice. A later change reads everything again through the major it picks.
  apiVersionState.subscribe((preference) => {
    probe?.setForced(envDialect ?? (preference === 'v1' ? 'v1' : undefined))
    if (!connected()) return
    void checkAuthAccess.execute()
    void schemaSync.execute()
    void loadEventsSpan.execute()
  })

  return {
    authSession,
    restoreAuthSession,
    checkAuthAccess,
    startAuthConnection,
    submitAuthCode,
    startAuthKeyEntry,
    submitAuthApiKey,
    stepBackAuthConnection,
    signOutOfAuth,
    copyAuthApiKey,
    schemaSync,
    schemaState,
    schemaSelection,
    loadSchemaSelection,
    saveSchemaSelection,
    eventsState,
    loadEventsSpan,
    themeState,
    loadTheme,
    saveTheme,
    languageState,
    loadLanguage,
    saveLanguage,
    weekNumbersState,
    loadWeekNumbers,
    saveWeekNumbers,
    weekStartState,
    loadWeekStart,
    saveWeekStart,
    calendarViewState,
    loadCalendarView,
    saveCalendarView,
    timeFormatState,
    loadTimeFormat,
    saveTimeFormat,
    apiVersionState,
    loadApiVersion,
    saveApiVersion
  }
}

function anytypeClient(): AnytypeClient {
  return new AnytypeClient({
    fetch: (url, init) =>
      fetch(url, { ...init, signal: AbortSignal.timeout(ANYTYPE_REQUEST_TIMEOUT_MS) })
  })
}

function dialectFromEnv(): AnytypeDialect | undefined {
  const forced = process.env['ANYTYPE_CALENDAR_API']
  return forced === 'v1' || forced === 'v2' ? forced : undefined
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
