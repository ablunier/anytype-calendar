import { DispatchGuard } from '@anytype-calendar/kernel/application'
import { nextAuthSession, type AuthEvent, type AuthSession } from '../domain'
import type { AuthSessionStore } from './session-store'

export class StepBackAuthConnection {
  readonly #guard: DispatchGuard<AuthSession, AuthEvent>

  constructor(store: AuthSessionStore) {
    this.#guard = new DispatchGuard(store, nextAuthSession)
  }

  execute(): void {
    this.#guard.dispatch({ type: 'stepped-back' })
  }
}
