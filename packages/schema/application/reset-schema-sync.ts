import { DispatchGuard } from '@anytype-calendar/kernel/application'
import { nextSchemaSync, type SchemaSync, type SchemaSyncEvent } from '../domain'
import type { SchemaSyncStore } from './schema-sync-store'

export class ResetSchemaSync {
  readonly #guard: DispatchGuard<SchemaSync, SchemaSyncEvent>

  constructor(store: SchemaSyncStore) {
    this.#guard = new DispatchGuard(store, nextSchemaSync)
  }

  execute(): void {
    this.#guard.dispatch({ type: 'reset' })
  }
}
