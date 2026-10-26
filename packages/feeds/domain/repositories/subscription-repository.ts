import type { FeedsSubscription } from '../model/subscription'

export interface FeedsSubscriptionRepository {
  /** In the user's order. Empty when nothing was saved, or what was cannot be read back. */
  load(): Promise<FeedsSubscription[]>
  /** Replaces what was saved; rejects when it could not be written. */
  save(subscriptions: readonly FeedsSubscription[]): Promise<void>
}
