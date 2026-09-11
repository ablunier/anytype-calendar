import { DispatchGuard } from '@anytype-calendar/kernel/application'
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
  readonly #guard: DispatchGuard<AuthSession, AuthEvent>
  readonly #appName: string
  readonly #now: () => number

  constructor({ gateway, store, appName, now = Date.now }: StartAuthConnectionDeps) {
    this.#gateway = gateway
    this.#guard = new DispatchGuard(store, nextAuthSession)
    this.#appName = appName
    this.#now = now
  }

  async execute(): Promise<void> {
    const origin = this.#guard.current()
    let challengeId: string
    try {
      challengeId = await this.#gateway.createChallenge(this.#appName)
    } catch {
      if (this.#guard.isCurrent(origin)) this.#guard.dispatch({ type: 'challenge-failed' })
      return
    }
    if (!this.#guard.isCurrent(origin)) return
    this.#guard.dispatch({
      type: 'challenge-issued',
      challenge: createAuthChallenge(challengeId, this.#now())
    })
  }
}
