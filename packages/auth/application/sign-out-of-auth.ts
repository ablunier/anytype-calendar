import { DispatchGuard } from '@anytype-calendar/kernel/application'
import { nextAuthSession, type AuthEvent, type AuthSession, type CredentialRepository } from '../domain'
import type { AuthSessionStore } from './session-store'

export interface SignOutOfAuthDeps {
  credentials: CredentialRepository
  store: AuthSessionStore
}

export class SignOutOfAuth {
  readonly #credentials: CredentialRepository
  readonly #guard: DispatchGuard<AuthSession, AuthEvent>

  constructor({ credentials, store }: SignOutOfAuthDeps) {
    this.#credentials = credentials
    this.#guard = new DispatchGuard(store, nextAuthSession)
  }

  async execute(): Promise<void> {
    await this.#credentials.clear()
    this.#guard.dispatch({ type: 'signed-out' })
  }
}
