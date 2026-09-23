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
import {
  EventsSpanStore,
  LoadEventsSpan,
  ResetEventsSpan
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
}

/** The only place adapters are chosen. Call it once the app is ready: safeStorage needs that. */
export function composeServices(): AppServices {
  // Swaps all of Anytype for a simulation: sign-in accepts 2749 (each challenge is logged
  // here), or the API key ak_fake_2749 pasted directly, and the schema and object reads
  // return the design's sample account.
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
  const startAuthKeyEntry = new StartAuthKeyEntry(authSession)
  const submitAuthApiKey = new SubmitAuthApiKey({ gateway: authGateway, credentials, store: authSession })
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

  const zone = new LocalEventsTimeZone()
  const eventsState = new EventsSpanStore()
  const loadEventsSpan = new LoadEventsSpan({
    gateway: client ? new AnytypeEventsGateway(client) : inMemoryEventsGateway(zone),
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

  // Contexts never know about each other, so the links live here. Being connected — signed
  // in just now, or a key restored at launch — is what reads the account and the month;
  // anything else forgets both. The stores notify only on change, and a reset while idle is
  // a no-op.
  const connected = (): boolean => authSession.get().phase === 'connected'
  authSession.subscribe((session) => {
    if (session.phase === 'connected') {
      void schemaSync.execute()
      void loadEventsSpan.execute()
    } else {
      resetSchemaSync.execute()
      resetEventsSpan.execute()
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
  schemaState.subscribe((state) => {
    if (state.phase === 'synced' && connected()) void loadEventsSpan.execute()
    if (state.phase === 'failed') handleUnauthorized(state.failure)
  })
  eventsState.subscribe((state) => {
    if (state.phase === 'failed') handleUnauthorized(state.failure)
  })
  schemaSelection.subscribe(() => {
    if (connected()) void loadEventsSpan.execute()
  })

  return {
    authSession,
    restoreAuthSession,
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
    saveTimeFormat
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
