import type { SchemaSelectionState } from '../domain'

export type SchemaSelectionListener = (state: SchemaSelectionState) => void

export class SchemaSelectionStore {
  #state: SchemaSelectionState
  readonly #listeners = new Set<SchemaSelectionListener>()

  constructor(initial: SchemaSelectionState = { phase: 'unset' }) {
    this.#state = initial
  }

  get(): SchemaSelectionState {
    return this.#state
  }

  /** Setting the current object again notifies no one. */
  set(state: SchemaSelectionState): void {
    if (state === this.#state) return
    this.#state = state
    for (const listener of this.#listeners) listener(state)
  }

  subscribe(listener: SchemaSelectionListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}
