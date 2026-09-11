import { describe, expect, test, vi } from 'vitest'
import type { SchemaSelection, SchemaSelectionRepository } from '../domain'
import { LoadSchemaSelection } from './load-schema-selection'
import { SaveSchemaSelection } from './save-schema-selection'
import { SchemaSelectionStore } from './schema-selection-store'

const SELECTION: SchemaSelection = {
  spaceIds: ['sp_1'],
  types: [{ spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null }]
}

function setup(stored: SchemaSelection | null = null) {
  const repository = {
    load: vi.fn<SchemaSelectionRepository['load']>(async () => stored),
    save: vi.fn<SchemaSelectionRepository['save']>(async () => {})
  }
  const store = new SchemaSelectionStore()
  const listener = vi.fn()
  store.subscribe(listener)
  return {
    repository,
    store,
    listener,
    load: new LoadSchemaSelection({ repository, store }),
    save: new SaveSchemaSelection({ repository, store })
  }
}

describe('LoadSchemaSelection', () => {
  test('restores a saved selection', async () => {
    const { store, load } = setup(SELECTION)
    await load.execute()
    expect(store.get()).toEqual({ phase: 'saved', selection: SELECTION })
  })

  test('is unset when none was saved', async () => {
    const { store, load } = setup(null)
    await load.execute()
    expect(store.get()).toEqual({ phase: 'unset' })
  })
})

describe('SaveSchemaSelection', () => {
  test('writes the selection, then holds it', async () => {
    const { repository, store, listener, save } = setup()
    await save.execute(SELECTION)
    expect(repository.save).toHaveBeenCalledWith(SELECTION)
    expect(store.get()).toEqual({ phase: 'saved', selection: SELECTION })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('leaves the store as it was when the write fails', async () => {
    const { repository, store, listener, save } = setup()
    repository.save.mockRejectedValueOnce(new Error('disk full'))
    await expect(save.execute(SELECTION)).rejects.toThrow('disk full')
    expect(store.get()).toEqual({ phase: 'unset' })
    expect(listener).not.toHaveBeenCalled()
  })
})
