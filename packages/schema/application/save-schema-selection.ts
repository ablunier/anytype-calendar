import type { SchemaSelection, SchemaSelectionRepository } from '../domain'
import type { SchemaSelectionStore } from './schema-selection-store'

export interface SaveSchemaSelectionDeps {
  repository: SchemaSelectionRepository
  store: SchemaSelectionStore
}

/**
 * Written before it is shown, so the app never draws a selection that would be gone after a
 * restart; a failed write rejects and leaves the store as it was.
 */
export class SaveSchemaSelection {
  readonly #repository: SchemaSelectionRepository
  readonly #store: SchemaSelectionStore

  constructor({ repository, store }: SaveSchemaSelectionDeps) {
    this.#repository = repository
    this.#store = store
  }

  async execute(selection: SchemaSelection): Promise<void> {
    await this.#repository.save(selection)
    this.#store.set({ phase: 'saved', selection })
  }
}
