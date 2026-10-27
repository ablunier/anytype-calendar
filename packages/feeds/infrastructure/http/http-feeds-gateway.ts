import type { FeedsFetchResult, FeedsGateway } from '../../domain'

/** The part of a `fetch` response this reads. */
export interface FeedsHttpResponse {
  ok: boolean
  status: number
  text(): Promise<string>
}

/**
 * Injected by the composition root, with a timeout: this layer has no `fetch` of its own.
 * Rejects when no answer came.
 */
export type FeedsFetch = (url: string, init: { headers: Record<string, string> }) => Promise<FeedsHttpResponse>

/** Reads feeds over HTTP(S), following redirects as `fetch` does. */
export class HttpFeedsGateway implements FeedsGateway {
  readonly #fetch: FeedsFetch

  constructor(fetch: FeedsFetch) {
    this.#fetch = fetch
  }

  async fetch(url: string): Promise<FeedsFetchResult> {
    try {
      const response = await this.#fetch(url, { headers: { Accept: 'text/calendar, */*;q=0.5' } })
      if (!response.ok) return { ok: false, failure: 'http', status: response.status }
      return { ok: true, text: await response.text() }
    } catch {
      return { ok: false, failure: 'unreachable' }
    }
  }
}
