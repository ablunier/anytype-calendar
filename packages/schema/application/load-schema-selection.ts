import type { SchemaSelectionRepository } from '../domain'
import type { SchemaSelectionStore } from './schema-selection-store'

export interface LoadSchemaSelectionDeps {
  repository: SchemaSelectionRepository
  store: SchemaSelectionStore
}

export class LoadSchemaSelection {
  readonly #repository: SchemaSelectionRepository
  readonly #store: SchemaSelectionStore

  constructor({ repository, store }: LoadSchemaSelectionDeps) {
    this.#repository = repository
    this.#store = store
  }

  async execute(): Promise<void> {
    const selection = await this.#repository.load()
    this.#store.set(selection ? { phase: 'saved', selection } : { phase: 'unset' })
  }
}
