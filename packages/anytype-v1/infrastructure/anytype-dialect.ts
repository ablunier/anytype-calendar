import type { AnytypeClient, AnytypeWhoami } from '@ablunier/anytype-client'

/**
 * Which major of the local API a gateway speaks. Both are served by the same process, on the
 * same port, to the same keys; v2 only by Anytype builds that ship it.
 */
export type AnytypeDialect = 'v1' | 'v2'

export type AnytypeDialectResult =
  | {
      ok: true
      dialect: AnytypeDialect
      /** Null under v1 or a forced v1. */
      whoami: AnytypeWhoami | null
    }
  | { ok: false; failure: 'unauthorized' }

export interface AnytypeDialectProbeOptions {
  client: AnytypeClient
  /** Skips detection, e.g. to exercise the v1 fallback against an Anytype that serves v2. */
  forced?: AnytypeDialect
}

const UNAUTHORIZED = 401

type Cached = { apiKey: string; result: Promise<AnytypeDialectResult>; dialect: AnytypeDialect | null }

/**
 * Asks Anytype once per key which major it serves, and remembers the answer: every context's
 * gateway asks before each call, so a sync and a span load racing at launch share one request.
 * Only a definite answer is remembered; a refused key or a failed request is asked again.
 */
export class AnytypeDialectProbe {
  readonly #client: AnytypeClient
  readonly #forced: AnytypeDialect | undefined
  #cached: Cached | null = null

  constructor({ client, forced }: AnytypeDialectProbeOptions) {
    this.#client = client
    this.#forced = forced
  }

  probe(apiKey: string): Promise<AnytypeDialectResult> {
    if (this.#forced === 'v1') return Promise.resolve({ ok: true, dialect: 'v1', whoami: null })
    if (this.#cached?.apiKey === apiKey) return this.#cached.result

    const cached: Cached = { apiKey, result: this.#ask(apiKey), dialect: null }
    this.#cached = cached
    const drop = (): void => {
      if (this.#cached === cached) this.#cached = null
    }
    cached.result.then((answer) => {
      if (answer.ok) cached.dialect = answer.dialect
      else drop()
    }, drop)
    return cached.result
  }

  forget(): void {
    this.#cached = null
  }

  /**
   * For when a v2 route stops answering: Anytype may have been downgraded under the app. An
   * answer of v1 already expects that, and a probe still asking reaches its own answer.
   */
  forgetV2(): void {
    if (this.#cached?.dialect === 'v2') this.#cached = null
  }

  async #ask(apiKey: string): Promise<AnytypeDialectResult> {
    const response = await this.#client.withApiKey(apiKey).auth.whoami({ spaces: true })
    if (response.ok) return { ok: true, dialect: 'v2', whoami: response.body }
    if (response.status === UNAUTHORIZED) return { ok: false, failure: 'unauthorized' }
    if (response.unsupported && this.#forced !== 'v2') return { ok: true, dialect: 'v1', whoami: null }
    throw new Error(`Anytype answered ${response.status} when asked which API it serves`)
  }
}
