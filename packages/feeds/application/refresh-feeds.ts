import {
  feedsFetchFailureOf,
  type FeedsCache,
  type FeedsCalendarParser,
  type FeedsGateway,
  type FeedsReadFailure,
  type FeedsSubscription
} from '../domain'
import type { FeedsStore } from './feeds-store'

export interface RefreshFeedsDeps {
  gateway: FeedsGateway
  parser: FeedsCalendarParser
  cache: FeedsCache
  store: FeedsStore
  now?: () => number
}

/**
 * Reads each feed again, all at once and each on its own: a slow feed holds up no other, and
 * a failed read keeps the last good copy drawn, with why it failed beside it. A feed already
 * being read is not asked twice.
 */
export class RefreshFeeds {
  readonly #gateway: FeedsGateway
  readonly #parser: FeedsCalendarParser
  readonly #cache: FeedsCache
  readonly #store: FeedsStore
  readonly #now: () => number
  readonly #reading = new Set<string>()

  constructor({ gateway, parser, cache, store, now = Date.now }: RefreshFeedsDeps) {
    this.#gateway = gateway
    this.#parser = parser
    this.#cache = cache
    this.#store = store
    this.#now = now
  }

  /** Every subscription, or only those of `ids`. */
  async execute(ids?: readonly string[]): Promise<void> {
    const targets = this.#store
      .subscriptions()
      .filter(({ id }) => ids === undefined || ids.includes(id))
    await Promise.all(targets.map((subscription) => this.#read(subscription)))
  }

  async #read({ id, url }: FeedsSubscription): Promise<void> {
    if (this.#reading.has(id)) return
    this.#reading.add(id)
    this.#store.update(id, { status: { ...this.#store.status(id), reading: true } })
    try {
      const result = await this.#gateway.fetch(url)
      // Pointed at another address meanwhile: that one was read when it was set.
      if (this.#store.subscription(id)?.url !== url) return this.#settle(id)
      if (!result.ok) return this.#fail(id, feedsFetchFailureOf(result))
      const calendar = this.#parser.parse(result.text)
      if (!calendar) return this.#fail(id, { failure: 'not-calendar' })
      const readAt = this.#now()
      this.#store.update(id, { calendar, status: { readAt, reading: false, error: null } })
      // Only a convenience for the next launch: a copy that cannot be written costs nothing now.
      if (this.#store.subscription(id)) {
        await this.#cache.write(id, { text: result.text, readAt }).catch(() => undefined)
      }
    } finally {
      this.#reading.delete(id)
    }
  }

  #settle(id: string): void {
    this.#store.update(id, { status: { ...this.#store.status(id), reading: false } })
  }

  #fail(id: string, failure: FeedsReadFailure): void {
    this.#store.update(id, {
      status: { ...this.#store.status(id), reading: false, error: { ...failure, at: this.#now() } }
    })
  }
}
