import type { AuthAccess } from '../model/access'

/** An Anytype too old to pair with is an expected answer, not an error. */
export type AuthChallengeResult =
  | { ok: true; challengeId: string }
  | { ok: false; failure: 'outdated' }

/**
 * A rejected code is an expected answer, not an error, so it is a value; only a transport
 * breakdown rejects the promise.
 */
export type AuthExchangeResult =
  | { ok: true; apiKey: string; access: AuthAccess }
  | { ok: false; failure: 'invalid-code' | 'expired' | 'outdated' }

/** A key Anytype does not recognise is an expected answer too, not an error. */
export type AuthVerifyResult =
  | { ok: true; access: AuthAccess }
  | { ok: false; failure: 'invalid-key' | 'outdated' }

/**
 * Every method rejects when Anytype cannot be reached. There is no cancellation — the
 * domain has no AbortSignal — so a caller that stops caring about an exchange discards its
 * result instead.
 *
 * Nothing revokes a key: the local API has no endpoint for it. A key is deleted only by
 * the user, in the Anytype app's API key settings.
 */
export interface AuthGateway {
  /** POST /v2/auth/challenges. Anytype shows the user a code; resolves the challenge id. */
  createChallenge(appName: string): Promise<AuthChallengeResult>

  /** POST /v2/auth/api_keys. */
  exchangeCode(challengeId: string, code: string): Promise<AuthExchangeResult>

  /**
   * Checks a key the user already holds, e.g. issued for this app in a previous run, and asks
   * afresh what it reaches: the user may have changed its grant in Anytype since.
   */
  verifyApiKey(apiKey: string): Promise<AuthVerifyResult>
}
