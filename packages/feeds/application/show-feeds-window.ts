import type { FeedsWindow } from '../domain'
import type { FeedsStore } from './feeds-store'

/** Expands the feeds already read over another window: no feed is read again for it. */
export class ShowFeedsWindow {
  readonly #store: FeedsStore

  constructor(store: FeedsStore) {
    this.#store = store
  }

  execute(window: FeedsWindow): void {
    this.#store.setWindow(window)
  }
}
