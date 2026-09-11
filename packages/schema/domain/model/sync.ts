import type { SchemaSpace } from './space'

export type SchemaSyncFailure =
  /** Anytype is not running, did not answer, or answered with something unusable. */
  | 'unreachable'
  /** No key is stored, or Anytype refused it — usually deleted in Anytype's settings. */
  | 'unauthorized'

export interface SchemaSyncResult {
  spaces: SchemaSpace[]
  /** Epoch milliseconds. */
  syncedAt: number
}

/**
 * `last` is the most recent successful result. It survives a new sync and a failed one, so
 * what was on screen stays there instead of blanking while Anytype is asked again.
 */
export type SchemaSync =
  | { phase: 'idle' }
  | { phase: 'syncing'; last?: SchemaSyncResult }
  | { phase: 'synced'; last: SchemaSyncResult }
  /** `at` is epoch milliseconds. */
  | { phase: 'failed'; failure: SchemaSyncFailure; at: number; last?: SchemaSyncResult }

export type SchemaSyncPhase = SchemaSync['phase']

export type SchemaSyncEvent =
  | { type: 'sync-started' }
  | { type: 'sync-succeeded'; spaces: SchemaSpace[]; at: number }
  | { type: 'sync-failed'; failure: SchemaSyncFailure; at: number }
  | { type: 'reset' }

/**
 * An event that does not apply to the current phase returns the state unchanged — the same
 * object, so callers can tell nothing happened. That absorbs a second sync requested while
 * one is running.
 */
export function nextSchemaSync(state: SchemaSync, event: SchemaSyncEvent): SchemaSync {
  switch (event.type) {
    case 'sync-started':
      return state.phase === 'syncing' ? state : withLast({ phase: 'syncing' }, lastResult(state))

    case 'sync-succeeded':
      return state.phase === 'syncing'
        ? { phase: 'synced', last: { spaces: event.spaces, syncedAt: event.at } }
        : state

    case 'sync-failed':
      return state.phase === 'syncing'
        ? withLast({ phase: 'failed', failure: event.failure, at: event.at }, state.last)
        : state

    case 'reset':
      return state.phase === 'idle' ? state : { phase: 'idle' }
  }
}

function lastResult(state: SchemaSync): SchemaSyncResult | undefined {
  return state.phase === 'idle' ? undefined : state.last
}

/** `exactOptionalPropertyTypes` forbids `last: undefined`, so an absent result is left off. */
function withLast<T extends SchemaSync>(state: T, last: SchemaSyncResult | undefined): T {
  return last ? { ...state, last } : state
}
