/* The only renderer module that reads a schema snapshot's shape; components get view models. */

import type { SchemaSnapshot } from '@shared/ipc'
import type { CategoryHue, Space, SyncView } from '@renderer/types'

/** Anytype gives spaces no colour the calendar can use, so each takes one by position. */
const SPACE_HUES: CategoryHue[] = ['teal', 'ochre', 'plum', 'graphite', 'sage', 'clay', 'dusk', 'rose']

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** The spaces of the last successful sync; empty until there is one. */
export function spacesFor(snapshot: SchemaSnapshot): Space[] {
  const spaces = snapshot.phase === 'idle' ? [] : (snapshot.last?.spaces ?? [])
  return spaces.map((space, index) => ({
    key: space.id,
    name: space.name,
    category: SPACE_HUES[index % SPACE_HUES.length] ?? 'graphite',
    objects: space.datedObjectCount
  }))
}

/** `now` is epoch milliseconds. */
export function syncViewFor(snapshot: SchemaSnapshot, now: number): SyncView {
  switch (snapshot.phase) {
    // Idle only until main starts the sync it runs on every sign-in.
    case 'idle':
    case 'syncing':
      return { state: 'syncing' }
    case 'synced':
      return { state: 'synced', detail: elapsedSince(snapshot.last.syncedAt, now) }
    case 'failed':
      return {
        state: 'error',
        detail: snapshot.failure === 'unauthorized' ? 'Key not accepted' : 'Is Anytype running?'
      }
  }
}

function elapsedSince(at: number, now: number): string {
  const elapsed = Math.max(0, now - at)
  if (elapsed < MINUTE_MS) return 'just now'
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} min ago`
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)} h ago`
  return `${Math.floor(elapsed / DAY_MS)} d ago`
}
