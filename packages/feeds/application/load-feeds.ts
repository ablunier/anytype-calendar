import type {
  FeedsCache,
  FeedsCalendarParser,
  FeedsSubscriptionRepository
} from '../domain'
import type { FeedsStore } from './feeds-store'

export interface LoadFeedsDeps {
  repository: FeedsSubscriptionRepository
  cache: FeedsCache
  parser: FeedsCalendarParser
  store: FeedsStore
}

/**
 * Restores the subscriptions at launch, each with its last good copy, so their events are
 * drawn before, or without, any read of the network.
 */
export class LoadFeeds {
  readonly #repository: FeedsSubscriptionRepository
  readonly #cache: FeedsCache
  readonly #parser: FeedsCalendarParser
  readonly #store: FeedsStore

  constructor({ repository, cache, parser, store }: LoadFeedsDeps) {
    this.#repository = repository
    this.#cache = cache
    this.#parser = parser
    this.#store = store
  }

  async execute(): Promise<void> {
    const subscriptions = await this.#repository.load()
    this.#store.setSubscriptions(subscriptions)
    await Promise.all(
      subscriptions.map(async ({ id }) => {
        const copy = await this.#cache.read(id).catch(() => null)
        const calendar = copy && this.#parser.parse(copy.text)
        // A read that landed first is newer than any copy.
        if (!copy || !calendar || this.#store.status(id).readAt !== null) return
        this.#store.update(id, {
          calendar,
          status: { ...this.#store.status(id), readAt: copy.readAt }
        })
      })
    )
  }
}
