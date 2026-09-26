import { DispatchGuard } from '@anytype-calendar/kernel/application'
import {
  nextAuthSession,
  type AuthEvent,
  type AuthGateway,
  type AuthSession,
  type AuthVerifyResult,
  type CredentialRepository
} from '../domain'
import type { AuthSessionStore } from './session-store'

export interface CheckAuthAccessDeps {
  gateway: AuthGateway
  credentials: CredentialRepository
  store: AuthSessionStore
}

/**
 * Asks Anytype which API it serves the connected key through, and what the key reaches. The
 * answer is applied only while the same key is still connected: an earlier check landing in
 * between replaces the session but keeps its key, a sign-out or a new sign-in does not.
 *
 * A refused key or an unreachable Anytype changes nothing here: the reads that run beside a
 * check meet the same answer, and those already sign a refused key out.
 */
export class CheckAuthAccess {
  readonly #gateway: AuthGateway
  readonly #credentials: CredentialRepository
  readonly #guard: DispatchGuard<AuthSession, AuthEvent>

  constructor({ gateway, credentials, store }: CheckAuthAccessDeps) {
    this.#gateway = gateway
    this.#credentials = credentials
    this.#guard = new DispatchGuard(store, nextAuthSession)
  }

  async execute(): Promise<void> {
    const connected = this.#guard.current()
    if (connected.phase !== 'connected') return
    const credential = await this.#credentials.load()
    if (!credential) return

    let result: AuthVerifyResult
    try {
      result = await this.#gateway.verifyApiKey(credential.apiKey)
    } catch {
      return
    }
    const now = this.#guard.current()
    if (!result.ok || now.phase !== 'connected' || now.key !== connected.key) return
    this.#guard.dispatch({ type: 'access-checked', access: result.access })
  }
}
