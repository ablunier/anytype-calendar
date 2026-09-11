import { nextAuthSession } from '../domain'
import type { AuthSessionStore } from './session-store'

export class StepBackAuthConnection {
  readonly #store: AuthSessionStore

  constructor(store: AuthSessionStore) {
    this.#store = store
  }

  execute(): void {
    this.#store.set(nextAuthSession(this.#store.get(), { type: 'stepped-back' }))
  }
}
