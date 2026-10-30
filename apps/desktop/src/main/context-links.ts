import type { AuthSession } from '@anytype-calendar/auth/domain'
import type { EventsSpanLoad } from '@anytype-calendar/events/domain'
import type { SchemaSpace, SchemaSync } from '@anytype-calendar/schema/domain'

interface Observed<T> {
  subscribe(listener: (value: T) => void): unknown
}

interface Run {
  execute(): unknown
}

export interface ContextLinksDeps {
  authSession: Observed<AuthSession> & { get(): AuthSession }
  checkAuthAccess: Run
  signOutOfAuth: Run
  schemaState: Observed<SchemaSync>
  schemaSelection: Observed<unknown>
  schemaSync: Run
  resetSchemaSync: Run
  rekeySchemaSelection: { execute(spaces: readonly SchemaSpace[]): Promise<void> }
  eventsState: Observed<EventsSpanLoad>
  loadEventsSpan: Run
  resetEventsSpan: Run
  showFeedsForSpan: () => void
}

/**
 * Contexts never know about each other, so the links live here. Being connected — signed in
 * just now, or a key restored at launch — is what reads the account and the span; anything
 * else forgets both. The stores notify only on change, and a reset while idle is a no-op.
 */
export function linkContexts({
  authSession,
  checkAuthAccess,
  signOutOfAuth,
  schemaState,
  schemaSelection,
  schemaSync,
  resetSchemaSync,
  rekeySchemaSelection,
  eventsState,
  loadEventsSpan,
  resetEventsSpan,
  showFeedsForSpan
}: ContextLinksDeps): void {
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
  // A fresh read of the account, or a changed selection, may change what the span holds. A
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
}
