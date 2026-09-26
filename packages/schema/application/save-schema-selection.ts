import type { SchemaSelection, SchemaSelectionRepository } from '../domain'
import type { SchemaSelectionStore } from './schema-selection-store'

export interface SaveSchemaSelectionDeps {
  repository: SchemaSelectionRepository
  store: SchemaSelectionStore
}

/**
 * Written before it is shown, so the app never draws a selection that would be gone after a
 * restart; a failed write rejects and leaves the store as it was.
 *
 * Saves run one at a time, in the order they were asked for. A selection can be saved on
 * every change, and two writes at once could finish out of order — leaving an older
 * selection on disk or in the store — or collide in a repository that replaces its file by
 * renaming over it.
 */
export class SaveSchemaSelection {
  readonly #repository: SchemaSelectionRepository
  readonly #store: SchemaSelectionStore
  /** Never rejects, so a failed save does not stop the ones queued behind it. */
  #previous: Promise<void> = Promise.resolve()

  constructor({ repository, store }: SaveSchemaSelectionDeps) {
    this.#repository = repository
    this.#store = store
  }

  execute(selection: SchemaSelection): Promise<void> {
    const save = this.#previous.then(() => this.#save(selection))
    this.#previous = save.catch(() => {})
    return save
  }

  /**
   * Saves what `change` makes of the selection as it stands once every save before it has
   * run, so it never undoes a newer choice. Nothing is written when there is no selection yet
   * or `change` returns the same object.
   */
  rewrite(change: (selection: SchemaSelection) => SchemaSelection): Promise<void> {
    const save = this.#previous.then(() => {
      const state = this.#store.get()
      if (state.phase !== 'saved') return
      const changed = change(state.selection)
      return changed === state.selection ? undefined : this.#save(changed)
    })
    this.#previous = save.catch(() => {})
    return save
  }

  async #save(selection: SchemaSelection): Promise<void> {
    await this.#repository.save(selection)
    this.#store.set({ phase: 'saved', selection })
  }
}
