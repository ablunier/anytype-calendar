import type { EventsMonthLoad } from '../domain'

export type EventsMonthListener = (state: EventsMonthLoad) => void

export class EventsMonthStore {
  #state: EventsMonthLoad
  readonly #listeners = new Set<EventsMonthListener>()

  constructor(initial: EventsMonthLoad = { phase: 'idle' }) {
    this.#state = initial
  }

  get(): EventsMonthLoad {
    return this.#state
  }

  /** Setting the current object again notifies no one — see nextEventsMonthLoad. */
  set(state: EventsMonthLoad): void {
    if (state === this.#state) return
    this.#state = state
    for (const listener of this.#listeners) listener(state)
  }

  subscribe(listener: EventsMonthListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}
