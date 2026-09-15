import { DispatchGuard } from '@anytype-calendar/kernel/application'
import {
  describeCredential,
  nextAuthSession,
  type AuthCredential,
  type AuthEvent,
  type AuthGateway,
  type AuthSession,
  type AuthVerifyResult,
  type CredentialRepository
} from '../domain'
import type { AuthSessionStore } from './session-store'

export interface SubmitAuthApiKeyDeps {
  gateway: AuthGateway
  credentials: CredentialRepository
  store: AuthSessionStore
  now?: () => number
}

/**
 * Mirrors SubmitAuthCode's guard and storage rules for a pasted key instead of an
 * exchanged one: a result is applied only if the store still holds the exact
 * `verifying-key` session it started from, and the credential is stored exactly when the
 * session ends up connected.
 */
export class SubmitAuthApiKey {
  readonly #gateway: AuthGateway
  readonly #credentials: CredentialRepository
  readonly #guard: DispatchGuard<AuthSession, AuthEvent>
  readonly #now: () => number

  constructor({ gateway, credentials, store, now = Date.now }: SubmitAuthApiKeyDeps) {
    this.#gateway = gateway
    this.#credentials = credentials
    this.#guard = new DispatchGuard(store, nextAuthSession)
    this.#now = now
  }

  async execute(apiKey: string): Promise<void> {
    const before = this.#guard.current()
    const verifying = this.#guard.dispatch({ type: 'key-submitted' })
    if (verifying === before || verifying.phase !== 'verifying-key') return

    let result: AuthVerifyResult
    try {
      result = await this.#gateway.verifyApiKey(apiKey)
    } catch {
      if (this.#guard.isCurrent(verifying)) {
        this.#guard.dispatch({ type: 'key-rejected', failure: 'unreachable' })
      }
      return
    }

    if (!result.ok) {
      if (this.#guard.isCurrent(verifying)) {
        this.#guard.dispatch({ type: 'key-rejected', failure: result.failure })
      }
      return
    }
    if (!this.#guard.isCurrent(verifying)) return

    const credential: AuthCredential = { apiKey, issuedAt: this.#now() }
    await this.#credentials.save(credential)
    if (!this.#guard.isCurrent(verifying)) return this.#credentials.clear()
    this.#guard.dispatch({ type: 'key-verified', key: describeCredential(credential) })
  }
}
