import { DispatchGuard } from '@anytype-calendar/kernel/application'
import {
  nextSchemaSync,
  SCHEMA_DONE_KEY,
  SCHEMA_LOCATION_KEY,
  userDateProperties,
  type SchemaApiKeySource,
  type SchemaGateway,
  type SchemaGatewayResult,
  type SchemaSelectOption,
  type SchemaSelectProperty,
  type SchemaSpace,
  type SchemaSpaceList,
  type SchemaSync,
  type SchemaSyncEvent,
  type SchemaType,
  type SchemaTypeRef
} from '../domain'
import type { SchemaSyncStore } from './schema-sync-store'

export interface SyncSchemaDeps {
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
export class SyncSchema {
  readonly #gateway: SchemaGateway
  readonly #apiKeys: SchemaApiKeySource
  readonly #guard: DispatchGuard<SchemaSync, SchemaSyncEvent>
  readonly #now: () => number

  constructor({ gateway, apiKeys, store, now = Date.now }: SyncSchemaDeps) {
    this.#gateway = gateway
    this.#apiKeys = apiKeys
    this.#guard = new DispatchGuard(store, nextSchemaSync)
    this.#now = now
  }

  async execute(): Promise<void> {
    const before = this.#guard.current()
    const syncing = this.#guard.dispatch({ type: 'sync-started' })
    if (syncing === before) return

    let read: { spaces: SchemaSpace[]; hasNotGrantedSpaces: boolean }
    try {
      read = await this.#fetchSpaces()
    } catch (error) {
      const failure = error instanceof Unauthorized ? 'unauthorized' : 'unreachable'
      if (this.#guard.isCurrent(syncing)) {
        this.#guard.dispatch({ type: 'sync-failed', failure, at: this.#now() })
      }
      return
    }
    if (this.#guard.isCurrent(syncing)) {
      this.#guard.dispatch({ type: 'sync-succeeded', ...read, at: this.#now() })
    }
  }

  async #fetchSpaces(): Promise<{ spaces: SchemaSpace[]; hasNotGrantedSpaces: boolean }> {
    const apiKey = await this.#apiKeys.current()
    if (apiKey === null) throw new Unauthorized()

    const listed: SchemaSpaceList = accepted(await this.#gateway.listSpaces(apiKey))
    const spaces = await Promise.all(
      listed.spaces.map(async ({ id, name, icon }) => {
        const types = await this.#fetchDatedTypes(apiKey, id)
        return icon === undefined ? { id, name, types } : { id, name, icon, types }
      })
    )
    return { spaces, hasNotGrantedSpaces: listed.hasNotGrantedSpaces }
  }

  async #fetchDatedTypes(apiKey: string, spaceId: string): Promise<SchemaType[]> {
    const refs = accepted(await this.#gateway.listTypes(apiKey, spaceId)).flatMap((ref) => {
      const dateProperties = userDateProperties(ref.properties)
      return dateProperties.length === 0 ? [] : [{ ref, dateProperties }]
    })
    const options = await this.#fetchSelectOptions(
      apiKey,
      spaceId,
      refs.flatMap(({ ref }) => ref.properties)
    )
    return refs.map(({ ref: { key, formerKey, name, icon, properties }, dateProperties }) => {
      const has = (propertyKey: string): boolean => properties.some((property) => property.key === propertyKey)
      const type: SchemaType = {
        key,
        name,
        icon,
        dateProperties,
        hasDone: has(SCHEMA_DONE_KEY),
        hasLocation: has(SCHEMA_LOCATION_KEY),
        selectProperties: properties.flatMap((property): SchemaSelectProperty[] => {
          const found = property.format === 'select' ? options.get(property.key) : undefined
          if (!found || found.length === 0) return []
          const select = { key: property.key, name: property.name, options: found }
          return [property.formerKey === undefined ? select : { ...select, formerKey: property.formerKey }]
        })
      }
      return formerKey === undefined ? type : { ...type, formerKey }
    })
  }

  /** A property's options are the space's, not a type's, so each is asked for once per space. */
  async #fetchSelectOptions(
    apiKey: string,
    spaceId: string,
    properties: SchemaTypeRef['properties']
  ): Promise<Map<string, SchemaSelectOption[]>> {
    const keys = [...new Set(properties.filter(({ format }) => format === 'select').map(({ key }) => key))]
    const lists = await Promise.all(
      keys.map(async (key) => accepted(await this.#gateway.listSelectOptions(apiKey, spaceId, key)))
    )
    return new Map(keys.map((key, index) => [key, lists[index] ?? []]))
  }
}

function accepted<T>(result: SchemaGatewayResult<T>): T {
  if (!result.ok) throw new Unauthorized()
  return result.value
}
