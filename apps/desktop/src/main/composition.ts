import { join } from 'path'
import { app } from 'electron'
import type {
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
import type {
  CompleteEventsObject,
  CreateEventsObject,
  EventsSpanStore,
  LoadEventsSpan,
  RescheduleEventsObject
} from '@anytype-calendar/events/application'
import type {
  AddFeedsSubscription,
  EditFeedsSubscription,
  FeedsStore,
  LoadFeeds,
  RefreshFeeds,
  RemoveFeedsSubscription,
  ReorderFeedsSubscriptions
} from '@anytype-calendar/feeds/application'
import type {
  LoadSchemaSelection,
  SaveSchemaSelection,
  SchemaSelectionStore,
  SchemaSyncStore,
  SyncSchema
} from '@anytype-calendar/schema/application'
import { composeAnytype } from './anytype/compose-anytype'
import { appConfigStore } from './app-config-file'
import { atomicFileAt } from './atomic-file'
import { composeAuth } from './auth/compose-auth'
import { linkContexts } from './context-links'
import { composeEvents } from './events/compose-events'
import { defaultEventsSpan } from './events/default-span'
import { eventsSourcesFor } from './events/event-sources'
import { composeFeeds } from './feeds/compose-feeds'
import { composePreferences, type Preferences } from './preferences/compose-preferences'
import { composeSchema } from './schema/compose-schema'
import { fetchLatestRelease } from './updates/auto-update'
import { CheckForUpdate, DismissUpdateNotice } from './updates/check-for-update'
import { UpdateNoticeStore } from './updates/update-notice-store'

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

/**
 * Each context's module chooses its adapters; this calls them all, once the app is ready:
 * safeStorage needs that.
 */
export function composeServices(): AppServices {
  const anytype = composeAnytype()
  const auth = composeAuth(anytype)
  const { apiKeys } = auth

  // One file holds every non-secret setting: the schema selection, the preferences, and
  // anything added later. The fake account's ids are not the real one's, so it gets its own
  // file, like the credential.
  const appConfig = appConfigStore(
    atomicFileAt(
      join(app.getPath('userData'), anytype.kind === 'fake' ? 'app-config-fake.json' : 'app-config.json'),
      0o644
    )
  )
  const preferences = composePreferences(appConfig)

  const schema = composeSchema({ anytype, apiKeys, appConfig })
  const events = composeEvents({
    anytype,
    apiKeys,
    // Adapts schema's stores to the selection port events declares.
    sources: { current: () => eventsSourcesFor(schema.schemaSelection.get(), schema.schemaState.get()) },
    defaultSpan: (today) =>
      defaultEventsSpan(preferences.calendarView.state.get(), today, preferences.weekStart.state.get())
  })
  const feeds = composeFeeds({ anytype, shownWindow: events.shownWindow })

  const updateNotice = new UpdateNoticeStore(app.getVersion())
  const checkForUpdate = new CheckForUpdate({
    config: appConfig,
    store: updateNotice,
    fetchLatest: fetchLatestRelease
  })
  const dismissUpdateNotice = new DismissUpdateNotice({ config: appConfig, store: updateNotice })

  linkContexts({ ...auth, ...schema, ...events, showFeedsForSpan: feeds.showFeedsForSpan })

  return {
    ...auth,
    ...schema,
    ...events,
    ...feeds,
    preferences,
    updateNotice,
    checkForUpdate,
    dismissUpdateNotice
  }
}
