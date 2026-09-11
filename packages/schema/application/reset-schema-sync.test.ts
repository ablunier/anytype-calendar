import { describe, expect, test, vi } from 'vitest'
import type { SchemaGateway } from '../domain'
import { ResetSchemaSync } from './reset-schema-sync'
import { SchemaSyncStore } from './schema-sync-store'
import { SyncSchema } from './sync-schema'

const API_KEY = 'ak_secret'

function setup() {
  const gateway = {
    listSpaces: vi.fn<SchemaGateway['listSpaces']>(async () => ({ ok: true, value: [] })),
    listTypes: vi.fn<SchemaGateway['listTypes']>(async () => ({ ok: true, value: [] })),
    countObjectsWithAnyValue: vi.fn<SchemaGateway['countObjectsWithAnyValue']>(async () => ({
      ok: true,
      value: 0
    }))
  }
  const store = new SchemaSyncStore()
  const syncSchema = new SyncSchema({ gateway, apiKeys: { current: async () => API_KEY }, store })
  const resetSchemaSync = new ResetSchemaSync(store)
  return { store, syncSchema, resetSchemaSync }
}

describe('reset', () => {
  test('forgets the synced spaces', async () => {
    const { store, syncSchema, resetSchemaSync } = setup()
    await syncSchema.execute()
    resetSchemaSync.execute()
    expect(store.get()).toEqual({ phase: 'idle' })
  })

  test('notifies no one when already idle', () => {
    const { store, resetSchemaSync } = setup()
    const listener = vi.fn()
    store.subscribe(listener)
    resetSchemaSync.execute()
    expect(listener).not.toHaveBeenCalled()
  })
})
