import { DispatchGuard } from '@anytype-calendar/kernel/application'
import {
  type AuthEvent,
  type AuthSession,
  type CredentialRepository,
  describeCredential,
  nextAuthSession,
} from '../domain'
import type { AuthSessionStore } from './session-store'

export interface RestoreAuthSessionDeps {
  credentials: CredentialRepository
  store: AuthSessionStore
}

export class RestoreAuthSession {
  readonly #credentials: CredentialRepository
  readonly #guard: DispatchGuard<AuthSession, AuthEvent>

  constructor({ credentials, store }: RestoreAuthSessionDeps) {
    this.#credentials = credentials
    this.#guard = new DispatchGuard(store, nextAuthSession)
  }

  async execute(): Promise<void> {
    const credential = await this.#credentials.load()
    if (credential) this.#guard.dispatch({ type: 'restored', key: describeCredential(credential) })
  }
}
