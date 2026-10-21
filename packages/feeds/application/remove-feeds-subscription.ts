import type { FeedsCache } from '../domain'
import type { SaveFeedsSubscriptions } from './save-feeds-subscriptions'

export interface RemoveFeedsSubscriptionDeps {
  save: SaveFeedsSubscriptions
  cache: FeedsCache
}

/** Its cached copy goes with it. */
export class RemoveFeedsSubscription {
  readonly #save: SaveFeedsSubscriptions
  readonly #cache: FeedsCache

  constructor({ save, cache }: RemoveFeedsSubscriptionDeps) {
    this.#save = save
    this.#cache = cache
  }

  async execute(id: string): Promise<void> {
    await this.#save.execute((current) =>
      current.some((subscription) => subscription.id === id)
        ? current.filter((subscription) => subscription.id !== id)
        : current
    )
    await this.#cache.remove(id).catch(() => undefined)
  }
}
