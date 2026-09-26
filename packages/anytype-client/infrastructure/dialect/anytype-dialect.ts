import type { AnytypeClient, AnytypeResponse } from '../http/anytype-client'

/**
 * Which major of the local API a gateway speaks. Both are served by the same process, on the
 * same port, to the same keys; v2 only by Anytype builds that ship it.
 */
export type AnytypeDialect = 'v1' | 'v2'

export type AnytypeDialectResult =
  | {
      ok: true
      dialect: AnytypeDialect
      /** The body of `GET /v2/auth/whoami`, unvalidated; null under v1 or a forced dialect. */
      whoami: unknown
    }
  | { ok: false; failure: 'unauthorized' }

export interface AnytypeDialectProbeOptions {
  client: AnytypeClient
  /** Skips detection, e.g. to exercise the v1 fallback against an Anytype that serves v2. */
  forced?: AnytypeDialect
}

const UNAUTHORIZED = 401
const NOT_FOUND = 404

/**
 * Asks Anytype once per key which major it serves, and remembers the answer: every context's
 * gateway asks before each call, so a sync and a span load racing at launch share one request.
 * Only a definite answer is remembered; a refused key or a failed request is asked again.
 */
export class AnytypeDialectProbe {
  readonly #client: AnytypeClient
  #forced: AnytypeDialect | undefined
  #cached: { apiKey: string; result: Promise<AnytypeDialectResult> } | null = null

  constructor({ client, forced }: AnytypeDialectProbeOptions) {
    this.#client = client
    this.#forced = forced
  }

  probe(apiKey: string): Promise<AnytypeDialectResult> {
    if (this.#forced === 'v1') return Promise.resolve({ ok: true, dialect: 'v1', whoami: null })
    if (this.#cached?.apiKey === apiKey) return this.#cached.result

    const result = this.#ask(apiKey)
    const cached = { apiKey, result }
    this.#cached = cached
    const drop = (): void => {
      if (this.#cached === cached) this.#cached = null
    }
    result.then((answer) => {
      if (!answer.ok) drop()
    }, drop)
    return result
  }

  /** For when a v2 route stops answering: Anytype may have been downgraded under the app. */
  forget(): void {
    this.#cached = null
  }

  /** Undefined goes back to asking Anytype. Either way the last answer is forgotten. */
  setForced(dialect: AnytypeDialect | undefined): void {
    this.#forced = dialect
    this.forget()
  }

  async #ask(apiKey: string): Promise<AnytypeDialectResult> {
    const response = await this.#client.request({
      method: 'GET',
      path: '/v2/auth/whoami?ids=full&spaces=true',
      apiKey
    })
    if (response.ok) return { ok: true, dialect: 'v2', whoami: response.body }
    if (response.status === UNAUTHORIZED) return { ok: false, failure: 'unauthorized' }
    if (isUnmatchedRoute(response) && this.#forced !== 'v2') {
      return { ok: true, dialect: 'v1', whoami: null }
    }
    throw new Error(`Anytype answered ${response.status} when asked which API it serves`)
  }
}

/**
 * An Anytype without v2 has no route for it, and an unmatched route answers a bare 404 with no
 * error envelope. A v2 handler's own 404 (an unknown space, type or object) always carries a
 * `code`, so the two cannot be confused.
 */
export function isUnmatchedRoute(response: AnytypeResponse): boolean {
  return !response.ok && response.status === NOT_FOUND && response.error.code === ''
}
