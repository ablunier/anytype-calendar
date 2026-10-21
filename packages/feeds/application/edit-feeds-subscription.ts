import type { FeedsColour } from '../domain'
import type { SaveFeedsSubscriptions } from './save-feeds-subscriptions'

export interface EditFeedsSubscriptionInput {
  id: string
  name?: string
  colour?: FeedsColour
}

/** Renames a subscription, or recolours it. Its address is not edited: a new one is a new subscription. */
export class EditFeedsSubscription {
  readonly #save: SaveFeedsSubscriptions

  constructor(save: SaveFeedsSubscriptions) {
    this.#save = save
  }

  execute({ id, name, colour }: EditFeedsSubscriptionInput): Promise<void> {
    return this.#save.execute((current) =>
      current.some((subscription) => subscription.id === id)
        ? current.map((subscription) =>
            subscription.id === id
              ? { ...subscription, ...(name === undefined ? {} : { name }), ...(colour === undefined ? {} : { colour }) }
              : subscription
          )
        : current
    )
  }
}
