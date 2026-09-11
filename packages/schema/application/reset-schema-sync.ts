import { nextSchemaSync } from '../domain'
import type { SchemaSyncStore } from './schema-sync-store'

export class ResetSchemaSync {
  readonly #store: SchemaSyncStore

  constructor(store: SchemaSyncStore) {
    this.#store = store
  }

  execute(): void {
    this.#store.set(nextSchemaSync(this.#store.get(), { type: 'reset' }))
  }
}
