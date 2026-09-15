import type { AuthFailure } from '../model/session'

/**
 * A rejected code is an expected answer, not an error, so it is a value; only a transport
 * breakdown rejects the promise.
 */
export type AuthExchangeResult =
  | { ok: true; apiKey: string }
  | { ok: false; failure: Exclude<AuthFailure, 'unreachable'> }

/** A key Anytype does not recognise is an expected answer too, not an error. */
export type AuthVerifyResult = { ok: true } | { ok: false; failure: 'invalid-key' }

/**
 * Every method rejects when Anytype cannot be reached. There is no cancellation — the
 * domain has no AbortSignal — so a caller that stops caring about an exchange discards its
 * result instead.
 *
 * Nothing revokes a key: the local API has no endpoint for it. A key is deleted only by
 * the user, in the Anytype app's API key settings.
 */
export interface AuthGateway {
  /** POST /v1/auth/challenges. Anytype shows the user a code; resolves the challenge id. */
  createChallenge(appName: string): Promise<string>

  /** POST /v1/auth/api_keys. */
  exchangeCode(challengeId: string, code: string): Promise<AuthExchangeResult>

  /** Checks a key the user already holds, e.g. issued for this app in a previous run. */
  verifyApiKey(apiKey: string): Promise<AuthVerifyResult>
}
