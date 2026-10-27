import type { FeedsSubscription, FeedsSubscriptionRepository } from '../../domain'

/** Lasts only until quit: where the OS offers no encryption, an address is never written in plaintext. */
export class InMemoryFeedsSubscriptionRepository implements FeedsSubscriptionRepository {
  #subscriptions: FeedsSubscription[] = []

  async load(): Promise<FeedsSubscription[]> {
    return [...this.#subscriptions]
  }

  async save(subscriptions: readonly FeedsSubscription[]): Promise<void> {
    this.#subscriptions = [...subscriptions]
  }
}
