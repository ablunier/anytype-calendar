import type { AuthFailure } from '../model/session'

/**
 * A rejected code is an expected answer, not an error, so it is a value; only a transport
 * breakdown rejects the promise.
 */
export type AuthExchangeResult =
  | { ok: true; apiKey: string }
  | { ok: false; failure: Exclude<AuthFailure, 'unreachable'> }

/**
 * Every method rejects when Anytype cannot be reached. There is no cancellation — the
 * domain has no AbortSignal — so a caller that stops caring about an exchange discards its
 * result instead.
 */
export interface AuthGateway {
  /** POST /v1/auth/challenges. Anytype shows the user a code; resolves the challenge id. */
  createChallenge(appName: string): Promise<string>

  /** POST /v1/auth/api_keys. */
  exchangeCode(challengeId: string, code: string): Promise<AuthExchangeResult>

  /** Deletes the key in Anytype itself, not just on this computer. */
  revokeKey(apiKey: string): Promise<void>
}
