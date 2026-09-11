import type { SchemaSync } from '../domain'

export type SchemaSyncListener = (state: SchemaSync) => void

export class SchemaSyncStore {
  #state: SchemaSync
  readonly #listeners = new Set<SchemaSyncListener>()

  constructor(initial: SchemaSync = { phase: 'idle' }) {
    this.#state = initial
  }

  get(): SchemaSync {
    return this.#state
  }

  /** Setting the current object again notifies no one — see nextSchemaSync. */
  set(state: SchemaSync): void {
    if (state === this.#state) return
    this.#state = state
    for (const listener of this.#listeners) listener(state)
  }

  subscribe(listener: SchemaSyncListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}
