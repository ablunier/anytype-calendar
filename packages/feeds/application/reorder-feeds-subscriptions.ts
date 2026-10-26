import type { SaveFeedsSubscriptions } from './save-feeds-subscriptions'

/**
 * Puts the subscriptions in the order of `ids`. One that does not name each subscription once
 * — a list from before one was added or removed — changes nothing.
 */
export class ReorderFeedsSubscriptions {
  readonly #save: SaveFeedsSubscriptions

  constructor(save: SaveFeedsSubscriptions) {
    this.#save = save
  }

  execute(ids: readonly string[]): Promise<void> {
    return this.#save.execute((current) => {
      const byId = new Map(current.map((subscription) => [subscription.id, subscription]))
      const reordered = ids.flatMap((id) => byId.get(id) ?? [])
      const complete = reordered.length === current.length && new Set(ids).size === ids.length
      const changed = reordered.some((subscription, index) => subscription !== current[index])
      return complete && changed ? reordered : current
    })
  }
}
