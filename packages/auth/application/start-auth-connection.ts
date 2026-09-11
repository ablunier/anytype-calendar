import {
  createAuthChallenge,
  nextAuthSession,
  type AuthEvent,
  type AuthGateway,
  type AuthSession
} from '../domain'
import type { AuthSessionStore } from './session-store'

export interface StartAuthConnectionDeps {
  gateway: AuthGateway
  store: AuthSessionStore
  /** Shown by Anytype when it asks the user to approve the connection. */
  appName: string
  now?: () => number
}

/**
 * A result is applied only if the store still holds the exact session the connection
 * attempt started from — anything that happened meanwhile (stepping back, a forced
 * session) replaced that object, so a late challenge is dropped instead of overwriting
 * newer state. See SubmitAuthCode for the matching guard on the exchange step.
 */
export class StartAuthConnection {
  readonly #gateway: AuthGateway
  readonly #store: AuthSessionStore
  readonly #appName: string
  readonly #now: () => number

  constructor({ gateway, store, appName, now = Date.now }: StartAuthConnectionDeps) {
    this.#gateway = gateway
    this.#store = store
    this.#appName = appName
    this.#now = now
  }

  async execute(): Promise<void> {
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

  #dispatch(event: AuthEvent): AuthSession {
    this.#store.set(nextAuthSession(this.#store.get(), event))
    return this.#store.get()
  }

  #isCurrent(session: AuthSession): boolean {
    return this.#store.get() === session
  }
}
