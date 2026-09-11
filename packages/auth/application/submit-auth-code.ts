import {
  describeCredential,
  nextAuthSession,
  type AuthCredential,
  type AuthEvent,
  type AuthExchangeResult,
  type AuthGateway,
  type AuthSession,
  type CredentialRepository
} from '../domain'
import type { AuthSessionStore } from './session-store'

export interface SubmitAuthCodeDeps {
  gateway: AuthGateway
  credentials: CredentialRepository
  store: AuthSessionStore
  now?: () => number
}

/**
 * A result is applied only if the store still holds the exact `verifying` session it
 * started from — stepping back, a re-submitted code, or a forced session replaced it, so a
 * late result is dropped instead of overwriting newer state. A key that arrives for such an
 * abandoned attempt is dropped; it stays listed in Anytype until the user deletes it there,
 * since the local API cannot revoke it.
 *
 * Invariant, upheld across every auth use case: a credential is stored exactly when the
 * session is connected.
 */
export class SubmitAuthCode {
  readonly #gateway: AuthGateway
  readonly #credentials: CredentialRepository
  readonly #store: AuthSessionStore
  readonly #now: () => number

  constructor({ gateway, credentials, store, now = Date.now }: SubmitAuthCodeDeps) {
    this.#gateway = gateway
    this.#credentials = credentials
    this.#store = store
    this.#now = now
  }

  async execute(code: string): Promise<void> {
    const before = this.#store.get()
    const verifying = this.#dispatch({ type: 'code-submitted', code, at: this.#now() })
    if (verifying === before || verifying.phase !== 'verifying') return

    let result: AuthExchangeResult
    try {
      result = await this.#gateway.exchangeCode(verifying.attempt.challenge.id, code)
    } catch {
      if (this.#isCurrent(verifying)) this.#dispatch({ type: 'exchange-failed', failure: 'unreachable' })
      return
    }

    if (!result.ok) {
      if (this.#isCurrent(verifying)) this.#dispatch({ type: 'exchange-failed', failure: result.failure })
      return
    }
    if (!this.#isCurrent(verifying)) return

    const credential: AuthCredential = { apiKey: result.apiKey, issuedAt: this.#now() }
    await this.#credentials.save(credential)
    if (!this.#isCurrent(verifying)) return this.#credentials.clear()
    this.#dispatch({ type: 'exchange-succeeded', key: describeCredential(credential) })
  }

  #dispatch(event: AuthEvent): AuthSession {
    this.#store.set(nextAuthSession(this.#store.get(), event))
    return this.#store.get()
  }

  #isCurrent(session: AuthSession): boolean {
    return this.#store.get() === session
  }
}
