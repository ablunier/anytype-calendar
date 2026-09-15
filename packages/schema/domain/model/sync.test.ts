import { describe, expect, test } from 'vitest'
import type { SchemaSpace } from './space'
import { nextSchemaSync, type SchemaSync, type SchemaSyncResult } from './sync'

const SPACES: SchemaSpace[] = [{ id: 'sp_1', name: 'Personal', types: [] }]
const LAST: SchemaSyncResult = { spaces: SPACES, syncedAt: 1_000 }

const idle: SchemaSync = { phase: 'idle' }
const syncing: SchemaSync = { phase: 'syncing' }
const synced: SchemaSync = { phase: 'synced', last: LAST }
const failed: SchemaSync = { phase: 'failed', failure: 'unreachable', at: 2_000 }

describe('sync-started', () => {
  test('starts from idle with no previous result', () => {
    expect(nextSchemaSync(idle, { type: 'sync-started' })).toEqual({ phase: 'syncing' })
  })

  test('keeps the previous result while syncing again', () => {
    expect(nextSchemaSync(synced, { type: 'sync-started' })).toEqual({ phase: 'syncing', last: LAST })
    expect(nextSchemaSync({ ...failed, last: LAST }, { type: 'sync-started' })).toEqual({
      phase: 'syncing',
      last: LAST
    })
  })

  test('retries after a failure with nothing synced yet', () => {
    expect(nextSchemaSync(failed, { type: 'sync-started' })).toEqual({ phase: 'syncing' })
  })

  test('is ignored while a sync is running', () => {
    expect(nextSchemaSync(syncing, { type: 'sync-started' })).toBe(syncing)
  })
})

describe('sync-succeeded', () => {
  test('records the spaces and when they were read', () => {
    expect(
      nextSchemaSync({ phase: 'syncing', last: LAST }, { type: 'sync-succeeded', spaces: [], at: 5_000 })
    ).toEqual({ phase: 'synced', last: { spaces: [], syncedAt: 5_000 } })
  })

  test('is ignored outside a sync', () => {
    for (const state of [idle, synced, failed]) {
      expect(nextSchemaSync(state, { type: 'sync-succeeded', spaces: SPACES, at: 5_000 })).toBe(state)
    }
  })
})

describe('sync-failed', () => {
  test('records the failure and keeps the previous result', () => {
    expect(
      nextSchemaSync(
        { phase: 'syncing', last: LAST },
        { type: 'sync-failed', failure: 'unauthorized', at: 5_000 }
      )
    ).toEqual({ phase: 'failed', failure: 'unauthorized', at: 5_000, last: LAST })
  })

  test('carries no result when nothing was synced yet', () => {
    expect(
      nextSchemaSync(syncing, { type: 'sync-failed', failure: 'unreachable', at: 5_000 })
    ).toEqual({ phase: 'failed', failure: 'unreachable', at: 5_000 })
  })

  test('is ignored outside a sync', () => {
    for (const state of [idle, synced, failed]) {
      expect(nextSchemaSync(state, { type: 'sync-failed', failure: 'unreachable', at: 5_000 })).toBe(
        state
      )
    }
  })
})

describe('reset', () => {
  test('forgets everything from any phase', () => {
    for (const state of [syncing, synced, failed]) {
      expect(nextSchemaSync(state, { type: 'reset' })).toEqual({ phase: 'idle' })
    }
  })

  test('is ignored when already idle', () => {
    expect(nextSchemaSync(idle, { type: 'reset' })).toBe(idle)
  })
})
