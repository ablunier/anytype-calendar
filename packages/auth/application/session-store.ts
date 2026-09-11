import type { AuthSession } from '../domain'

export type AuthSessionListener = (session: AuthSession) => void

export class AuthSessionStore {
  #session: AuthSession
  readonly #listeners = new Set<AuthSessionListener>()

  constructor(initial: AuthSession = { phase: 'signed-out' }) {
    this.#session = initial
  }

  get(): AuthSession {
    return this.#session
  }

  /** Setting the current object again notifies no one — see nextAuthSession. */
  set(session: AuthSession): void {
    if (session === this.#session) return
    this.#session = session
    for (const listener of this.#listeners) listener(session)
  }

  subscribe(listener: AuthSessionListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
}
