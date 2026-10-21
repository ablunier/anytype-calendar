import type { FeedsSubscription, FeedsSubscriptionRepository } from '../domain'
import type { FeedsStore } from './feeds-store'

export interface SaveFeedsSubscriptionsDeps {
  repository: FeedsSubscriptionRepository
  store: FeedsStore
}

/**
 * Writes the subscriptions, then holds them. Changes run one at a time, each over the list the
 * one before it left, so adding one while renaming another keeps both.
 */
export class SaveFeedsSubscriptions {
  readonly #repository: FeedsSubscriptionRepository
  readonly #store: FeedsStore
  #queue: Promise<unknown> = Promise.resolve()

  constructor({ repository, store }: SaveFeedsSubscriptionsDeps) {
    this.#repository = repository
    this.#store = store
  }

  /** Returning the list it was given writes nothing. Rejects when it could not be written. */
  execute(
    change: (current: readonly FeedsSubscription[]) => readonly FeedsSubscription[]
  ): Promise<void> {
    const run = async (): Promise<void> => {
      const current = this.#store.subscriptions()
      const next = change(current)
      if (next === current) return
      await this.#repository.save(next)
      this.#store.setSubscriptions(next)
    }
    const result = this.#queue.then(run, run)
    this.#queue = result.catch(() => undefined)
    return result
  }
}
