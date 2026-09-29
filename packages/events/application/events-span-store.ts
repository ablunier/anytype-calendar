import { withEventsEdits, type EventsDatedObject, type EventsSpanLoad } from '../domain'

export type EventsSpanListener = (shown: EventsSpanLoad) => void

/**
 * Holds the span's load, which use cases dispatch to through `get`/`set`, and the edits being
 * written, which `shown` draws over it. Listeners are given what is shown.
 */
export class EventsSpanStore {
  #state: EventsSpanLoad
  /** In the order they were made, so a later edit of an object wins. */
  #edits: EventsDatedObject[] = []
  #shown: EventsSpanLoad
  readonly #listeners = new Set<EventsSpanListener>()

  constructor(initial: EventsSpanLoad = { phase: 'idle' }) {
    this.#state = initial
    this.#shown = initial
  }

  get(): EventsSpanLoad {
    return this.#state
  }

  /** Setting the current object again notifies no one — see nextEventsSpanLoad. */
  set(state: EventsSpanLoad): void {
    if (state === this.#state) return
    this.#state = state
    this.#publish()
  }

  /** The load with the edits in flight drawn over it. */
  shown(): EventsSpanLoad {
    return this.#shown
  }

  /** Draws `edit` in place of the object it edits until the returned release is called. */
  hold(edit: EventsDatedObject): () => void {
    this.#edits = [...this.#edits, edit]
    this.#publish()
    return () => {
      if (!this.#edits.includes(edit)) return
      this.#edits = this.#edits.filter((held) => held !== edit)
      this.#publish()
    }
  }

  subscribe(listener: EventsSpanListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  #publish(): void {
    const shown = withEventsEdits(this.#state, this.#edits)
    if (shown === this.#shown) return
    this.#shown = shown
    for (const listener of this.#listeners) listener(shown)
  }
}
