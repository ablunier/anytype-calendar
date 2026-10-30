import { randomBytes } from 'crypto'
import { join } from 'path'
import { setTimeout as sleep } from 'timers/promises'
import { app, safeStorage } from 'electron'
import { AnytypeClient } from '@ablunier/anytype-client'
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
import {
  CompleteEventsObject,
  CreateEventsObject,
  EventsSpanStore,
  LoadEventsSpan,
  RescheduleEventsObject,
  ResetEventsSpan
} from '@anytype-calendar/events/application'
import {
  eventsSpanWindow,
  shownEventsSpan,
  type EventsGateway,
  type EventsSpan,
  type EventsTimeZone,
  type EventsWriter
} from '@anytype-calendar/events/domain'
import {
  AnytypeEventsGateway,
  AnytypeEventsWriter,
  InMemoryEventsGateway,
  LocalEventsTimeZone
} from '@anytype-calendar/events/infrastructure'
import {
  AddFeedsSubscription,
  EditFeedsSubscription,
  FeedsStore,
  LoadFeeds,
  RefreshFeeds,
  RemoveFeedsSubscription,
  ReorderFeedsSubscriptions,
  SaveFeedsSubscriptions,
  ShowFeedsWindow
} from '@anytype-calendar/feeds/application'
import type {
  FeedsCache,
  FeedsGateway,
  FeedsSubscriptionRepository
} from '@anytype-calendar/feeds/domain'
import {
  EncryptedFileFeedsSubscriptionRepository,
  FileFeedsCache,
  HttpFeedsGateway,
  IcalFeedsCalendarParser,
  InMemoryFeedsCache,
  InMemoryFeedsGateway,
  InMemoryFeedsSubscriptionRepository,
  LocalFeedsTimeZone
} from '@anytype-calendar/feeds/infrastructure'
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
  InMemorySchemaGateway,
  JsonFileSchemaSelectionRepository
} from '@anytype-calendar/schema/infrastructure'
import { appConfigStore } from './app-config-file'
import { atomicFileAt } from './atomic-file'
import { credentialFileAt, safeStorageCipher } from './auth/credential-storage'
import { defaultEventsSpan } from './events/default-span'
import { eventsSourcesFor } from './events/event-sources'
import { cacheDirectoryAt, safeStorageUrlCipher, subscriptionFileAt } from './feeds/feeds-storage'
import { composePreferences, type Preferences } from './preferences/compose-preferences'
import { selectionFileAt } from './schema/selection-storage'
import { fetchLatestRelease } from './updates/auto-update'
import { CheckForUpdate, DismissUpdateNotice } from './updates/check-for-update'
import { UpdateNoticeStore } from './updates/update-notice-store'

/**
 * A closed Anytype refuses the connection at once; this bounds one that accepts it and
 * never answers, which would otherwise leave the UI verifying forever.
 */
const ANYTYPE_REQUEST_TIMEOUT_MS = 10_000

/** A feed comes from anywhere on the internet, and a big one takes a while to send. */
const FEED_REQUEST_TIMEOUT_MS = 30_000

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
  rescheduleEventsObject: RescheduleEventsObject
  createEventsObject: CreateEventsObject
  completeEventsObject: CompleteEventsObject
  feedsState: FeedsStore
  loadFeeds: LoadFeeds
  refreshFeeds: RefreshFeeds
  addFeedsSubscription: AddFeedsSubscription
  editFeedsSubscription: EditFeedsSubscription
  removeFeedsSubscription: RemoveFeedsSubscription
  reorderFeedsSubscriptions: ReorderFeedsSubscriptions
  /** Expands the feeds over the span on screen, or before any, the one a launch opens on. */
  showFeedsForSpan: () => void
  preferences: Preferences
  updateNotice: UpdateNoticeStore
  checkForUpdate: CheckForUpdate
  dismissUpdateNotice: DismissUpdateNotice
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
    gateway: client
      ? new AnytypeSchemaGateway({ client, encodeBase64: (bytes) => Buffer.from(bytes).toString('base64') })
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

  const preferences = composePreferences(appConfig)

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
  const openingSpan = (): EventsSpan =>
    defaultEventsSpan(
      preferences.calendarView.state.get(),
      zone.dayOf(Date.now()),
      preferences.weekStart.state.get()
    )
  const eventsState = new EventsSpanStore()
  const events = client ? anytypeEvents(client) : inMemoryEvents(zone)
  const eventSources = { current: () => eventsSourcesFor(schemaSelection.get(), schemaState.get()) }
  const loadEventsSpan = new LoadEventsSpan({
    gateway: events.gateway,
    apiKeys,
    sources: eventSources,
    zone,
    store: eventsState,
    // A launch opens on the view last chosen, so the first read is the one the window draws.
    defaultSpan: openingSpan
  })
  const resetEventsSpan = new ResetEventsSpan(eventsState)
  const editDeps = {
    writer: events.writer,
    apiKeys,
    sources: eventSources,
    zone,
    store: eventsState,
    load: loadEventsSpan
  }
  const rescheduleEventsObject = new RescheduleEventsObject(editDeps)
  const createEventsObject = new CreateEventsObject(editDeps)
  const completeEventsObject = new CompleteEventsObject(editDeps)

  // Feeds need nothing of Anytype: they are read, and kept, whether or not it is connected.
  // The fake account gets its own files, like the credential, so a sample feed added in fake
  // mode never shows against the real one.
  const feedsState = new FeedsStore()
  const feedsStorage = feedsStorageFor(fakeAnytype ? 'feeds-fake' : 'feeds')
  const feedsGateway: FeedsGateway = fakeAnytype ? inMemoryFeedsGateway() : httpFeedsGateway()
  const feedsParser = new IcalFeedsCalendarParser(new LocalFeedsTimeZone())
  const saveFeedsSubscriptions = new SaveFeedsSubscriptions({
    repository: feedsStorage.repository,
    store: feedsState
  })
  const loadFeeds = new LoadFeeds({
    repository: feedsStorage.repository,
    cache: feedsStorage.cache,
    parser: feedsParser,
    store: feedsState
  })
  const refreshFeeds = new RefreshFeeds({
    gateway: feedsGateway,
    parser: feedsParser,
    cache: feedsStorage.cache,
    store: feedsState
  })
  const addFeedsSubscription = new AddFeedsSubscription({
    gateway: feedsGateway,
    parser: feedsParser,
    cache: feedsStorage.cache,
    store: feedsState,
    save: saveFeedsSubscriptions,
    newId: () => randomBytes(8).toString('hex')
  })
  const editFeedsSubscription = new EditFeedsSubscription({
    gateway: feedsGateway,
    parser: feedsParser,
    cache: feedsStorage.cache,
    store: feedsState,
    save: saveFeedsSubscriptions
  })
  const removeFeedsSubscription = new RemoveFeedsSubscription({
    save: saveFeedsSubscriptions,
    cache: feedsStorage.cache
  })
  const reorderFeedsSubscriptions = new ReorderFeedsSubscriptions(saveFeedsSubscriptions)
  const showFeedsWindow = new ShowFeedsWindow(feedsState)
  // The feeds follow the span the calendar shows, which events holds. Expanding the copies in
  // memory is all moving to another span takes: no feed is read again for it.
  const showFeedsForSpan = (): void =>
    showFeedsWindow.execute(eventsSpanWindow(shownEventsSpan(eventsState.get()) ?? openingSpan(), zone))

  const updateNotice = new UpdateNoticeStore(app.getVersion())
  const checkForUpdate = new CheckForUpdate({
    config: appConfig,
    store: updateNotice,
    fetchLatest: fetchLatestRelease
  })
  const dismissUpdateNotice = new DismissUpdateNotice({ config: appConfig, store: updateNotice })

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
    }
  })
  // A key Anytype no longer accepts — usually deleted in its settings — answers unauthorized
  // to every request from here on, so retrying it is pointless. Signing out clears it and
  // flips the session away from `connected`, which the line above already resets both stores
  // for, and which the renderer already reads as "show sign-in" — so a rejected key sends the
  // user back there instead of leaving them stuck on a screen that can never read anything.
  // An outdated Anytype keeps the key: it is still valid, and works once Anytype is updated.
  const handleUnauthorized = (failure: 'unreachable' | 'unauthorized' | 'outdated'): void => {
    if (failure === 'unauthorized' && connected()) void signOutOfAuth.execute()
  }
  // A fresh read of the account, or a changed selection, may change what the month holds. A
  // reload replaces a load still running, so a burst of Settings changes draws only the last.
  // A selection saved while the app read through v1 may name types by keys v2 spells
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
    showFeedsForSpan()
  })
  schemaSelection.subscribe(() => {
    if (connected()) void loadEventsSpan.execute()
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
    rescheduleEventsObject,
    createEventsObject,
    completeEventsObject,
    feedsState,
    loadFeeds,
    refreshFeeds,
    addFeedsSubscription,
    editFeedsSubscription,
    removeFeedsSubscription,
    reorderFeedsSubscriptions,
    showFeedsForSpan,
    preferences,
    updateNotice,
    checkForUpdate,
    dismissUpdateNotice
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

function anytypeEvents(client: AnytypeClient): { gateway: EventsGateway; writer: EventsWriter } {
  return {
    gateway: new AnytypeEventsGateway({ client, warn: (message) => console.warn(message) }),
    writer: new AnytypeEventsWriter(client)
  }
}

/** One fake for both, so an edit shows on the next read. */
function inMemoryEvents(zone: EventsTimeZone): { gateway: EventsGateway; writer: EventsWriter } {
  const fake = new InMemoryEventsGateway({ sleep: (ms) => sleep(ms), zone, now: Date.now })
  return { gateway: fake, writer: fake }
}

function httpFeedsGateway(): FeedsGateway {
  return new HttpFeedsGateway((url, init) =>
    fetch(url, { ...init, signal: AbortSignal.timeout(FEED_REQUEST_TIMEOUT_MS) })
  )
}

/** Every `.ics` address answers a sample feed around the current month. */
function inMemoryFeedsGateway(): FeedsGateway {
  console.info('[feeds] Fake feeds: add any https address ending in .ics to subscribe to a sample')
  return new InMemoryFeedsGateway({ sleep: (ms) => sleep(ms), now: Date.now })
}

/**
 * `<name>.json` holds the subscriptions, each address sealed as the API key is, and
 * `<name>-cache/` the last good copy of each feed. Without OS encryption neither is written:
 * a secret address is a credential, and its copy as private as it.
 */
function feedsStorageFor(name: string): { repository: FeedsSubscriptionRepository; cache: FeedsCache } {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[feeds] OS encryption is unavailable; subscriptions will not survive a restart')
    return { repository: new InMemoryFeedsSubscriptionRepository(), cache: new InMemoryFeedsCache() }
  }
  if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
    console.warn('[feeds] No keyring found; feed addresses are stored obfuscated, not encrypted')
  }
  const userData = app.getPath('userData')
  return {
    repository: new EncryptedFileFeedsSubscriptionRepository({
      cipher: safeStorageUrlCipher,
      file: subscriptionFileAt(join(userData, `${name}.json`))
    }),
    cache: new FileFeedsCache(cacheDirectoryAt(join(userData, `${name}-cache`)))
  }
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
