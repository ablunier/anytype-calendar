import {
  feedsFetchFailureOf,
  feedsUrlHost,
  nextFeedsColour,
  toFeedsName,
  toFeedsUrl,
  type FeedsAddOutcome,
  type FeedsCache,
  type FeedsCalendarParser,
  type FeedsGateway
} from '../domain'
import type { FeedsStore } from './feeds-store'
import type { SaveFeedsSubscriptions } from './save-feeds-subscriptions'

export interface AddFeedsSubscriptionInput {
  /** As the user typed it; `webcal://` is read as `https://`. */
  url: string
  /** Empty takes the name the feed gives itself, or else its host. */
  name: string
}

export interface AddFeedsSubscriptionDeps {
  gateway: FeedsGateway
  parser: FeedsCalendarParser
  cache: FeedsCache
  store: FeedsStore
  save: SaveFeedsSubscriptions
  /** Random hex, safe in a file name. */
  newId: () => string
  now?: () => number
}

/**
 * The feed is read before anything is saved, so a mistyped address, or one that is not a
 * calendar, is refused with why, and leaves nothing behind. It goes last in the order, in a
 * colour no other subscription has yet.
 */
export class AddFeedsSubscription {
  readonly #gateway: FeedsGateway
  readonly #parser: FeedsCalendarParser
  readonly #cache: FeedsCache
  readonly #store: FeedsStore
  readonly #save: SaveFeedsSubscriptions
  readonly #newId: () => string
  readonly #now: () => number

  constructor({ gateway, parser, cache, store, save, newId, now = Date.now }: AddFeedsSubscriptionDeps) {
    this.#gateway = gateway
    this.#parser = parser
    this.#cache = cache
    this.#store = store
    this.#save = save
    this.#newId = newId
    this.#now = now
  }

  /** Rejects only when the subscription could not be written. */
  async execute({ url, name }: AddFeedsSubscriptionInput): Promise<FeedsAddOutcome> {
    const address = toFeedsUrl(url)
    if (address === null) return { ok: false, failure: 'invalid-url' }
    const given = name.trim() === '' ? null : toFeedsName(name)
    if (name.trim() !== '' && given === null) return { ok: false, failure: 'invalid-name' }

    const result = await this.#gateway.fetch(address)
    if (!result.ok) return { ok: false, ...feedsFetchFailureOf(result) }
    const calendar = this.#parser.parse(result.text)
    if (!calendar) return { ok: false, failure: 'not-calendar' }

    const id = this.#newId()
    const readAt = this.#now()
    await this.#save.execute((current) => [
      ...current,
      {
        id,
        name: given ?? toFeedsName(calendar.name) ?? feedsUrlHost(address),
        url: address,
        colour: nextFeedsColour(current.map(({ colour }) => colour))
      }
    ])
    this.#store.update(id, { calendar, status: { readAt, reading: false, error: null } })
    await this.#cache.write(id, { text: result.text, readAt }).catch(() => undefined)
    return { ok: true, id }
  }
}
