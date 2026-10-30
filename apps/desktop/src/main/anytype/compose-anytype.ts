import { AnytypeClient } from '@ablunier/anytype-client'

/**
 * A closed Anytype refuses the connection at once; this bounds one that accepts it and
 * never answers, which would otherwise leave the UI verifying forever.
 */
const ANYTYPE_REQUEST_TIMEOUT_MS = 10_000

/**
 * `fake` swaps all of Anytype for a simulation: sign-in accepts 2749 (each challenge is logged
 * to the terminal), or the API key ak_fake_2749 pasted directly, and the schema and object
 * reads return the design's sample account.
 */
export type Anytype = { kind: 'fake' } | { kind: 'real'; client: AnytypeClient }

/** Every context's Anytype gateway shares the one client. */
export function composeAnytype(): Anytype {
  if (process.env['ANYTYPE_CALENDAR_FAKE_AUTH'] === '1') return { kind: 'fake' }
  const client = new AnytypeClient({
    fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(ANYTYPE_REQUEST_TIMEOUT_MS) })
  })
  return { kind: 'real', client }
}
