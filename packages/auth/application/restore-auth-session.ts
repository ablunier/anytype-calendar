import {
  describeCredential,
  nextAuthSession,
  type AuthEvent,
  type AuthSession,
  type CredentialRepository
} from '../domain'
import type { AuthSessionStore } from './session-store'

export interface RestoreAuthSessionDeps {
  credentials: CredentialRepository
  store: AuthSessionStore
}

export class RestoreAuthSession {
  readonly #credentials: CredentialRepository
  readonly #store: AuthSessionStore

  constructor({ credentials, store }: RestoreAuthSessionDeps) {
    this.#credentials = credentials
    this.#store = store
  }

  async execute(): Promise<void> {
    const credential = await this.#credentials.load()
    if (credential) this.#dispatch({ type: 'restored', key: describeCredential(credential) })
  }

  #dispatch(event: AuthEvent): AuthSession {
    this.#store.set(nextAuthSession(this.#store.get(), event))
    return this.#store.get()
  }
}
