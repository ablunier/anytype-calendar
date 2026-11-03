import { describe, expect, test, vi } from 'vitest'
import { AuthSessionStore } from '@anytype-calendar/auth/application'
import type { AuthAccess, AuthSession } from '@anytype-calendar/auth/domain'
import { EventsSpanStore } from '@anytype-calendar/events/application'
import type { EventsSpan } from '@anytype-calendar/events/domain'
import { SchemaSelectionStore, SchemaSyncStore } from '@anytype-calendar/schema/application'
import { EMPTY_SCHEMA_SELECTION, type SchemaSpace } from '@anytype-calendar/schema/domain'
import { linkContexts } from './context-links'

const KEY = { hint: 'abcd', issuedAt: 0 }
const SPAN: EventsSpan = { kind: 'month', year: 2026, month: 9 }
const SPACES: SchemaSpace[] = []

function connected(access: AuthAccess | null): AuthSession {
  return { phase: 'connected', key: KEY, access }
}

function setup() {
  const deps = {
    authSession: new AuthSessionStore(),
    checkAuthAccess: { execute: vi.fn() },
    signOutOfAuth: { execute: vi.fn() },
    schemaState: new SchemaSyncStore(),
    schemaSelection: new SchemaSelectionStore(),
    schemaSync: { execute: vi.fn() },
    resetSchemaSync: { execute: vi.fn() },
    rekeySchemaSelection: { execute: vi.fn(async (_spaces: readonly SchemaSpace[]) => undefined) },
    eventsState: new EventsSpanStore(),
    loadEventsSpan: { execute: vi.fn() },
    resetEventsSpan: { execute: vi.fn() },
    showFeedsForSpan: vi.fn()
  }
  linkContexts(deps)
  return deps
}

function synced(deps: ReturnType<typeof setup>): void {
  deps.schemaState.set({ phase: 'synced', last: { spaces: SPACES, hasNotGrantedSpaces: false, syncedAt: 0 } })
}

describe('entering connected', () => {
  test('checks access only while access is null', () => {
    const restored = setup()
    restored.authSession.set(connected(null))
    expect(restored.checkAuthAccess.execute).toHaveBeenCalledTimes(1)

    const signedIn = setup()
    signedIn.authSession.set(connected({ grant: null }))
    expect(signedIn.checkAuthAccess.execute).not.toHaveBeenCalled()
  })

  test('syncs the schema and loads the span once', () => {
    const deps = setup()
    deps.authSession.set(connected(null))
    expect(deps.schemaSync.execute).toHaveBeenCalledTimes(1)
    expect(deps.loadEventsSpan.execute).toHaveBeenCalledTimes(1)
  })

  test('reads nothing again when access-checked replaces a session that stays connected', () => {
    const deps = setup()
    deps.authSession.set(connected(null))
    deps.authSession.set(connected({ grant: null }))
    expect(deps.checkAuthAccess.execute).toHaveBeenCalledTimes(1)
    expect(deps.schemaSync.execute).toHaveBeenCalledTimes(1)
    expect(deps.loadEventsSpan.execute).toHaveBeenCalledTimes(1)
  })
})

describe('leaving connected', () => {
  test('resets the schema and the span', () => {
    const deps = setup()
    deps.authSession.set(connected(null))
    deps.authSession.set({ phase: 'signed-out' })
    expect(deps.resetSchemaSync.execute).toHaveBeenCalledTimes(1)
    expect(deps.resetEventsSpan.execute).toHaveBeenCalledTimes(1)
  })
})

describe('an unauthorized failure', () => {
  test('signs out while connected, from the schema or the span', () => {
    const deps = setup()
    deps.authSession.set(connected(null))
    deps.schemaState.set({ phase: 'failed', failure: 'unauthorized', at: 0 })
    deps.eventsState.set({ phase: 'failed', span: SPAN, failure: 'unauthorized', at: 0 })
    expect(deps.signOutOfAuth.execute).toHaveBeenCalledTimes(2)
  })

  test('signs nothing out while not connected', () => {
    const deps = setup()
    deps.schemaState.set({ phase: 'failed', failure: 'unauthorized', at: 0 })
    deps.eventsState.set({ phase: 'failed', span: SPAN, failure: 'unauthorized', at: 0 })
    expect(deps.signOutOfAuth.execute).not.toHaveBeenCalled()
  })

  test('is the only failure that signs out', () => {
    const deps = setup()
    deps.authSession.set(connected(null))
    deps.schemaState.set({ phase: 'failed', failure: 'outdated', at: 0 })
    deps.eventsState.set({ phase: 'failed', span: SPAN, failure: 'unreachable', at: 0 })
    expect(deps.signOutOfAuth.execute).not.toHaveBeenCalled()
  })
})

describe('reloading the span', () => {
  test('follows a sync while connected', () => {
    const deps = setup()
    deps.authSession.set(connected(null))
    deps.loadEventsSpan.execute.mockClear()
    synced(deps)
    expect(deps.loadEventsSpan.execute).toHaveBeenCalledTimes(1)
  })

  test('follows a saved selection while connected', () => {
    const deps = setup()
    deps.authSession.set(connected(null))
    deps.loadEventsSpan.execute.mockClear()
    deps.schemaSelection.set({ phase: 'saved', selection: EMPTY_SCHEMA_SELECTION })
    expect(deps.loadEventsSpan.execute).toHaveBeenCalledTimes(1)
  })

  test('waits for a connection', () => {
    const deps = setup()
    synced(deps)
    deps.schemaSelection.set({ phase: 'saved', selection: EMPTY_SCHEMA_SELECTION })
    expect(deps.loadEventsSpan.execute).not.toHaveBeenCalled()
  })
})

describe('a sync', () => {
  test('rekeys the selection to the spaces it read', () => {
    const deps = setup()
    synced(deps)
    expect(deps.rekeySchemaSelection.execute).toHaveBeenCalledWith(SPACES)
  })
})

describe('the span', () => {
  test('redraws the feeds over each change', () => {
    const deps = setup()
    deps.eventsState.set({ phase: 'loading', span: SPAN })
    expect(deps.showFeedsForSpan).toHaveBeenCalledTimes(1)
  })
})
