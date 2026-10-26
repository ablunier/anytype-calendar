import {
  compareFeedsEvents,
  feedsUrlHost,
  NO_FEEDS,
  sameFeedsWindow,
  UNREAD_FEED,
  type FeedsCalendar,
  type FeedsEvent,
  type FeedsOccurrence,
  type FeedsReadStatus,
  type FeedsState,
  type FeedsSubscription,
  type FeedsWindow
} from '../domain'

export type FeedsListener = (state: FeedsState) => void

/**
 * Holds the subscriptions, each one's last good read, and the window on screen, and publishes
 * the events of the one in the other. A feed is read once and expanded over each window from
 * memory, so moving between spans never waits on a network; an expansion is kept until its
 * feed or the window changes. The subscriptions' addresses stay here: the state published
 * names each only by host.
 */
export class FeedsStore {
  #subscriptions: readonly FeedsSubscription[] = []
  readonly #statuses = new Map<string, FeedsReadStatus>()
  readonly #calendars = new Map<string, FeedsCalendar>()
  readonly #expanded = new Map<string, FeedsOccurrence[]>()
  #window: FeedsWindow | null = null
  #state: FeedsState = NO_FEEDS
  readonly #listeners = new Set<FeedsListener>()

  get(): FeedsState {
    return this.#state
  }

  subscriptions(): readonly FeedsSubscription[] {
    return this.#subscriptions
  }

  subscription(id: string): FeedsSubscription | undefined {
    return this.#subscriptions.find((subscription) => subscription.id === id)
  }

  status(id: string): FeedsReadStatus {
    return this.#statuses.get(id) ?? UNREAD_FEED
  }

  /** Forgets the reads of the subscriptions `subscriptions` leaves out. */
  setSubscriptions(subscriptions: readonly FeedsSubscription[]): void {
    this.#subscriptions = subscriptions
    const kept = new Set(subscriptions.map(({ id }) => id))
    for (const map of [this.#statuses, this.#calendars, this.#expanded]) {
      for (const id of map.keys()) if (!kept.has(id)) map.delete(id)
    }
    this.#publish()
  }

  setWindow(window: FeedsWindow): void {
    if (sameFeedsWindow(window, this.#window)) return
    this.#window = window
    this.#expanded.clear()
    this.#publish()
  }

  /** Ignored for a subscription no longer held, e.g. one removed while it was being read. */
  update(id: string, { calendar, status }: { calendar?: FeedsCalendar; status: FeedsReadStatus }): void {
    if (!this.subscription(id)) return
    if (calendar) {
      this.#calendars.set(id, calendar)
      this.#expanded.delete(id)
    }
    this.#statuses.set(id, status)
    this.#publish()
  }

  subscribe(listener: FeedsListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  #publish(): void {
    this.#state = {
      subscriptions: this.#subscriptions.map(({ id, name, colour, url }) => ({
        id,
        name,
        colour,
        host: feedsUrlHost(url),
        status: this.status(id)
      })),
      window: this.#window,
      events: this.#events()
    }
    for (const listener of this.#listeners) listener(this.#state)
  }

  #events(): FeedsEvent[] {
    const window = this.#window
    if (window === null) return []
    return this.#subscriptions
      .flatMap(({ id }, rank) =>
        this.#occurrences(id, window).map((occurrence) => ({ ...occurrence, feedId: id, rank }))
      )
      .sort(compareFeedsEvents)
  }

  #occurrences(id: string, window: FeedsWindow): FeedsOccurrence[] {
    const calendar = this.#calendars.get(id)
    if (!calendar) return []
    let occurrences = this.#expanded.get(id)
    if (!occurrences) {
      occurrences = calendar.occurrencesIn(window)
      this.#expanded.set(id, occurrences)
    }
    return occurrences
  }
}
