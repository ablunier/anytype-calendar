import { describe, expect, test, vi } from 'vitest'
import type { SchemaSelection, SchemaSelectionRepository } from '../domain'
import { LoadSchemaSelection } from './load-schema-selection'
import { SaveSchemaSelection } from './save-schema-selection'
import { SchemaSelectionStore } from './schema-selection-store'

const SELECTION: SchemaSelection = {
  spaceIds: ['sp_1'],
  types: [{ spaceId: 'sp_1', typeKey: 'task', from: 'due_date', to: null }]
}

const LATER: SchemaSelection = { spaceIds: [], types: [] }

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })
  return { promise, resolve }
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

  test('starts a save only once the one before it has finished', async () => {
    const { repository, store, save } = setup()
    const first = deferred()
    repository.save.mockReturnValueOnce(first.promise)

    const saving = [save.execute(SELECTION), save.execute(LATER)]
    await Promise.resolve()
    expect(repository.save).toHaveBeenCalledTimes(1)

    first.resolve()
    await Promise.all(saving)
    expect(repository.save.mock.calls).toEqual([[SELECTION], [LATER]])
    expect(store.get()).toEqual({ phase: 'saved', selection: LATER })
  })

  test('still runs a save queued behind one that fails', async () => {
    const { repository, store, save } = setup()
    repository.save.mockRejectedValueOnce(new Error('disk full'))

    const failed = save.execute(SELECTION)
    await expect(save.execute(LATER)).resolves.toBeUndefined()
    await expect(failed).rejects.toThrow('disk full')
    expect(store.get()).toEqual({ phase: 'saved', selection: LATER })
  })
})

describe('SaveSchemaSelection.rewrite', () => {
  test('rewrites the selection as the saves queued before it left it', async () => {
    const { repository, store, save } = setup()
    store.set({ phase: 'saved', selection: SELECTION })
    const first = deferred()
    repository.save.mockImplementationOnce(() => first.promise)

    const saving = save.execute(LATER)
    const rewriting = save.rewrite((selection) => ({ ...selection, spaceIds: [...selection.spaceIds, 'sp_9'] }))
    first.resolve()
    await Promise.all([saving, rewriting])

    expect(repository.save).toHaveBeenLastCalledWith({ spaceIds: ['sp_9'], types: [] })
    expect(store.get()).toEqual({ phase: 'saved', selection: { spaceIds: ['sp_9'], types: [] } })
  })

  test('writes nothing when the change returns the same selection', async () => {
    const { repository, store, save } = setup()
    store.set({ phase: 'saved', selection: SELECTION })

    await save.rewrite((selection) => selection)

    expect(repository.save).not.toHaveBeenCalled()
  })

  test('writes nothing before a selection was ever saved', async () => {
    const { repository, save } = setup()
    const change = vi.fn((selection: SchemaSelection) => selection)

    await save.rewrite(change)

    expect(change).not.toHaveBeenCalled()
    expect(repository.save).not.toHaveBeenCalled()
  })
})
