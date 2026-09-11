import {
  createAuthChallenge,
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

export interface AuthServiceDeps {
  gateway: AuthGateway
  credentials: CredentialRepository
  store: AuthSessionStore
  /** Shown by Anytype when it asks the user to approve the connection. */
  appName: string
  now?: () => number
}

/**
 * Async results are applied only if the store still holds the exact session the operation
 * started from. Anything that happened meanwhile — stepping back, a re-submitted code, a
 * forced session — replaced that object, so a late result is dropped instead of
 * overwriting newer state. A repeated intent the domain ignores leaves the object as it
 * was, so it does not invalidate the operation already in flight. A key that arrives for
 * such an abandoned attempt is dropped; it stays listed in Anytype until the user deletes
 * it there, since the local API cannot revoke it.
 *
 * Invariant: a credential is stored exactly when the session is connected.
 */
export class AuthService {
  readonly #gateway: AuthGateway
  readonly #credentials: CredentialRepository
  readonly #store: AuthSessionStore
  readonly #appName: string
  readonly #now: () => number

  constructor({ gateway, credentials, store, appName, now = Date.now }: AuthServiceDeps) {
    this.#gateway = gateway
    this.#credentials = credentials
    this.#store = store
    this.#appName = appName
    this.#now = now
  }

  async restore(): Promise<void> {
    const credential = await this.#credentials.load()
    if (credential) this.#dispatch({ type: 'restored', key: describeCredential(credential) })
  }

  async startConnection(): Promise<void> {
    const origin = this.#store.get()
    let challengeId: string
    try {
      challengeId = await this.#gateway.createChallenge(this.#appName)
    } catch {
      if (this.#isCurrent(origin)) this.#dispatch({ type: 'challenge-failed' })
      return
    }
    if (!this.#isCurrent(origin)) return
    this.#dispatch({
      type: 'challenge-issued',
      challenge: createAuthChallenge(challengeId, this.#now())
    })
  }

  async submitCode(code: string): Promise<void> {
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

  stepBack(): void {
    this.#dispatch({ type: 'stepped-back' })
  }

  async signOut(): Promise<void> {
    await this.#credentials.clear()
    this.#dispatch({ type: 'signed-out' })
  }

  /**
   * Hands the stored key to `write` — a sink such as the clipboard — instead of returning
   * it, so the key goes no further than that one call. Resolves whether there was a key.
   */
  async copyKeyTo(write: (apiKey: string) => void): Promise<boolean> {
    const credential = await this.#credentials.load()
    if (!credential) return false
    write(credential.apiKey)
    return true
  }

  #dispatch(event: AuthEvent): AuthSession {
    this.#store.set(nextAuthSession(this.#store.get(), event))
    return this.#store.get()
  }

  #isCurrent(session: AuthSession): boolean {
    return this.#store.get() === session
  }
}
