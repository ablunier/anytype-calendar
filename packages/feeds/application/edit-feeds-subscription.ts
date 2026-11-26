import {
  type FeedsCache,
  type FeedsCalendar,
  type FeedsCalendarParser,
  type FeedsColour,
  type FeedsEditOutcome,
  type FeedsGateway,
  type FeedsSubscription,
  feedsFetchFailureOf,
  feedsSubscriptionWithUrl,
  sameFeedsUrl,
  toFeedsUrl,
} from '../domain'
import type { FeedsStore } from './feeds-store'
import type { SaveFeedsSubscriptions } from './save-feeds-subscriptions'

export interface EditFeedsSubscriptionInput {
  id: string
  name?: string
  colour?: FeedsColour
  /** As the user typed it; `webcal://` is read as `https://`. */
  url?: string
}

export interface EditFeedsSubscriptionDeps {
  gateway: FeedsGateway
  parser: FeedsCalendarParser
  cache: FeedsCache
  store: FeedsStore
  save: SaveFeedsSubscriptions
  now?: () => number
}

/**
 * Renames a subscription, recolours it, or points it at another address. A new address is
 * read before anything is saved, as when adding one, so one that is mistyped, not a calendar,
 * or another subscription's, is refused with why and the subscription keeps the address it had. What the new
 * one holds replaces the old copy at once, cached copy included.
 */
export class EditFeedsSubscription {
  readonly #gateway: FeedsGateway
  readonly #parser: FeedsCalendarParser
  readonly #cache: FeedsCache
  readonly #store: FeedsStore
  readonly #save: SaveFeedsSubscriptions
  readonly #now: () => number

  constructor({ gateway, parser, cache, store, save, now = Date.now }: EditFeedsSubscriptionDeps) {
    this.#gateway = gateway
    this.#parser = parser
    this.#cache = cache
    this.#store = store
    this.#save = save
    this.#now = now
  }

  /** Rejects only when the change could not be written. */
  async execute({ id, name, colour, url }: EditFeedsSubscriptionInput): Promise<FeedsEditOutcome> {
    let moved: { url: string; text: string; calendar: FeedsCalendar } | null = null
    if (url !== undefined) {
      const address = toFeedsUrl(url)
      if (address === null) return { ok: false, failure: 'invalid-url' }
      const currentUrl = this.#store.subscription(id)?.url
      if (currentUrl === undefined || !sameFeedsUrl(address, currentUrl)) {
        // Only spares a pointless read: the check that holds is the one inside the save.
        const early = feedsSubscriptionWithUrl(this.#store.subscriptions(), address, id)
        if (early) return { ok: false, failure: 'duplicate', name: early.name }
        const result = await this.#gateway.fetch(address)
        if (!result.ok) return { ok: false, ...feedsFetchFailureOf(result) }
        const calendar = this.#parser.parse(result.text)
        if (!calendar) return { ok: false, failure: 'not-calendar' }
        moved = { url: address, text: result.text, calendar }
      }
    }
    const change: Partial<FeedsSubscription> = {
      ...(name === undefined ? {} : { name }),
      ...(colour === undefined ? {} : { colour }),
      ...(moved === null ? {} : { url: moved.url }),
    }
    let holder: FeedsSubscription | undefined
    await this.#save.execute((current) => {
      holder = moved === null ? undefined : feedsSubscriptionWithUrl(current, moved.url, id)
      if (holder || !current.some((subscription) => subscription.id === id)) return current
      return current.map((subscription) => (subscription.id === id ? { ...subscription, ...change } : subscription))
    })
    if (holder) return { ok: false, failure: 'duplicate', name: holder.name }
    if (moved !== null && this.#store.subscription(id)) {
      const readAt = this.#now()
      this.#store.update(id, { calendar: moved.calendar, status: { readAt, reading: false, error: null } })
      await this.#cache.write(id, { text: moved.text, readAt }).catch(() => undefined)
    }
    return { ok: true }
  }
}
