import { nextAuthSession, type CredentialRepository } from '../domain'
import type { AuthSessionStore } from './session-store'

export interface SignOutOfAuthDeps {
  credentials: CredentialRepository
  store: AuthSessionStore
}

export class SignOutOfAuth {
  readonly #credentials: CredentialRepository
  readonly #store: AuthSessionStore

  constructor({ credentials, store }: SignOutOfAuthDeps) {
    this.#credentials = credentials
    this.#store = store
  }

  async execute(): Promise<void> {
    await this.#credentials.clear()
    this.#store.set(nextAuthSession(this.#store.get(), { type: 'signed-out' }))
  }
}
