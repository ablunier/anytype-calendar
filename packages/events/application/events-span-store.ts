import type { EventsSpanLoad } from '../domain'

export type EventsSpanListener = (state: EventsSpanLoad) => void

export class EventsSpanStore {
  #state: EventsSpanLoad
  readonly #listeners = new Set<EventsSpanListener>()

  constructor(initial: EventsSpanLoad = { phase: 'idle' }) {
    this.#state = initial
  }

  get(): EventsSpanLoad {
    return this.#state
  }

  /** Setting the current object again notifies no one — see nextEventsSpanLoad. */
  set(state: EventsSpanLoad): void {
    if (state === this.#state) return
    this.#state = state
    for (const listener of this.#listeners) listener(state)
  }

  subscribe(listener: EventsSpanListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}
