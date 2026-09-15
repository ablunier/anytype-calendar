import { DispatchGuard } from '@anytype-calendar/kernel/application'
import { nextAuthSession, type AuthEvent, type AuthSession } from '../domain'
import type { AuthSessionStore } from './session-store'

/** Switches the start screen from the code challenge to pasting a key the user already has. */
export class StartAuthKeyEntry {
  readonly #guard: DispatchGuard<AuthSession, AuthEvent>

  constructor(store: AuthSessionStore) {
    this.#guard = new DispatchGuard(store, nextAuthSession)
  }

  execute(): void {
    this.#guard.dispatch({ type: 'key-entry-opened' })
  }
}
