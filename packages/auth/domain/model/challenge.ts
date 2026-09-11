/**
 * The local API does not report an expiry, so the calendar keeps its own clock on the
 * challenge — this is the lifetime the app promises the user ("codes last 60 seconds").
 */
export const AUTH_CHALLENGE_LIFETIME_MS = 60_000

export const AUTH_CODE_LENGTH = 4

const WELL_FORMED_CODE = new RegExp(`^[0-9]{${AUTH_CODE_LENGTH}}$`)

/** Anytype shows the matching code only to the user, never to the app. */
export interface AuthChallenge {
  id: string
  /** Epoch milliseconds. */
  expiresAt: number
}

export function createAuthChallenge(id: string, issuedAt: number): AuthChallenge {
  return { id, expiresAt: issuedAt + AUTH_CHALLENGE_LIFETIME_MS }
}

export function isChallengeExpired(challenge: AuthChallenge, now: number): boolean {
  return now >= challenge.expiresAt
}

export function isWellFormedAuthCode(code: string): boolean {
  return WELL_FORMED_CODE.test(code)
}
