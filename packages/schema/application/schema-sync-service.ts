import {
  nextSchemaSync,
  userDatePropertyKeys,
  type SchemaApiKeySource,
  type SchemaGateway,
  type SchemaGatewayResult,
  type SchemaSpace,
  type SchemaSync,
  type SchemaSyncEvent
} from '../domain'
import type { SchemaSyncStore } from './schema-sync-store'

export interface SchemaSyncServiceDeps {
  gateway: SchemaGateway
  apiKeys: SchemaApiKeySource
  store: SchemaSyncStore
  now?: () => number
}

/** Thrown inside a sync to stop it at the first refused request. */
class Unauthorized extends Error {}

/**
 * A sync's result is applied only if the store still holds the exact `syncing` state it
 * started — a reset (the user signed out) replaced it, so a late result is dropped instead
 * of repopulating a signed-out app.
 */
export class SchemaSyncService {
  readonly #gateway: SchemaGateway
  readonly #apiKeys: SchemaApiKeySource
  readonly #store: SchemaSyncStore
  readonly #now: () => number

  constructor({ gateway, apiKeys, store, now = Date.now }: SchemaSyncServiceDeps) {
    this.#gateway = gateway
    this.#apiKeys = apiKeys
    this.#store = store
    this.#now = now
  }

  async sync(): Promise<void> {
    const before = this.#store.get()
    const syncing = this.#dispatch({ type: 'sync-started' })
    if (syncing === before) return

    let spaces: SchemaSpace[]
    try {
      spaces = await this.#fetchSpaces()
    } catch (error) {
      const failure = error instanceof Unauthorized ? 'unauthorized' : 'unreachable'
      if (this.#isCurrent(syncing)) this.#dispatch({ type: 'sync-failed', failure, at: this.#now() })
      return
    }
    if (this.#isCurrent(syncing)) this.#dispatch({ type: 'sync-succeeded', spaces, at: this.#now() })
  }

  reset(): void {
    this.#dispatch({ type: 'reset' })
  }

  async #fetchSpaces(): Promise<SchemaSpace[]> {
    const apiKey = await this.#apiKeys.current()
    if (apiKey === null) throw new Unauthorized()

    const refs = accepted(await this.#gateway.listSpaces(apiKey))
    return Promise.all(
      refs.map(async ({ id, name }) => ({
        id,
        name,
        datedObjectCount: await this.#countDatedObjects(apiKey, id)
      }))
    )
  }

  async #countDatedObjects(apiKey: string, spaceId: string): Promise<number> {
    const properties = accepted(await this.#gateway.listProperties(apiKey, spaceId))
    const keys = userDatePropertyKeys(properties)
    if (keys.length === 0) return 0
    return accepted(await this.#gateway.countObjectsWithAnyValue(apiKey, spaceId, keys))
  }

  #dispatch(event: SchemaSyncEvent): SchemaSync {
    this.#store.set(nextSchemaSync(this.#store.get(), event))
    return this.#store.get()
  }

  #isCurrent(state: SchemaSync): boolean {
    return this.#store.get() === state
  }
}

function accepted<T>(result: SchemaGatewayResult<T>): T {
  if (!result.ok) throw new Unauthorized()
  return result.value
}
