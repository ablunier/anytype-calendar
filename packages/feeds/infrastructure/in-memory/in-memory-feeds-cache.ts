import type { FeedsCache, FeedsCopy } from '../../domain'

export class InMemoryFeedsCache implements FeedsCache {
  readonly #copies = new Map<string, FeedsCopy>()

  async read(feedId: string): Promise<FeedsCopy | null> {
    return this.#copies.get(feedId) ?? null
  }

  async write(feedId: string, copy: FeedsCopy): Promise<void> {
    this.#copies.set(feedId, copy)
  }

  async remove(feedId: string): Promise<void> {
    this.#copies.delete(feedId)
  }
}
