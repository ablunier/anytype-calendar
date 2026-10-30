import { join } from 'path'
import { app } from 'electron'
import { composeAnytype } from './anytype/compose-anytype'
import { appConfigStore } from './app-config-file'
import { atomicFileAt } from './atomic-file'
import { composeAuth } from './auth/compose-auth'
import { linkContexts } from './context-links'
import { composeEvents } from './events/compose-events'
import { defaultEventsSpan } from './events/default-span'
import { eventsSourcesFor } from './events/event-sources'
import { composeFeeds } from './feeds/compose-feeds'
import { composePreferences } from './preferences/compose-preferences'
import { composeSchema } from './schema/compose-schema'
import { composeUpdates } from './updates/compose-updates'

/**
 * Each context's module chooses its adapters; this calls them all, once the app is ready:
 * safeStorage needs that.
 */
export function composeServices() {
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
  const updates = composeUpdates(appConfig)

  linkContexts({ ...auth, ...schema, ...events, showFeedsForSpan: feeds.showFeedsForSpan })

  return { auth, schema, events, feeds, preferences, updates }
}
