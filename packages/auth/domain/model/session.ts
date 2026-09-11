import { isChallengeExpired, isWellFormedAuthCode, type AuthChallenge } from './challenge'
import type { ApiKeyInfo } from './credential'

export type AuthFailure =
  | 'invalid-code'
  | 'expired'
  /** Usually the Anytype desktop app is not running. */
  | 'unreachable'

/** Grouped so a code never appears without the challenge it was submitted against. */
export interface AuthAttempt {
  challenge: AuthChallenge
  code: string
}

/**
 * Holds no secret — a connected session carries only ApiKeyInfo, never the key — so it
 * can be handed to any process that needs to draw it.
 */
export type AuthSession =
  | { phase: 'signed-out' }
  | { phase: 'awaiting-code'; challenge: AuthChallenge }
  | { phase: 'verifying'; attempt: AuthAttempt }
  /** `attempt` is absent when no challenge could be opened. */
  | { phase: 'failed'; failure: AuthFailure; attempt?: AuthAttempt }
  | { phase: 'connected'; key: ApiKeyInfo }

export type AuthSessionPhase = AuthSession['phase']

export type AuthEvent =
  | { type: 'challenge-issued'; challenge: AuthChallenge }
  /** Opening a challenge can only fail by Anytype being unreachable. */
  | { type: 'challenge-failed' }
  /** `at` decides whether the code arrived before its challenge expired. */
  | { type: 'code-submitted'; code: string; at: number }
  | { type: 'exchange-succeeded'; key: ApiKeyInfo }
  | { type: 'exchange-failed'; failure: AuthFailure }
  | { type: 'stepped-back' }
  | { type: 'restored'; key: ApiKeyInfo }
  | { type: 'signed-out' }

/**
 * An event that does not apply to the current phase returns the session unchanged — the
 * same object, so callers can skip notifying anyone. That absorbs double-clicks and races
 * (a late exchange result after the user stepped back) without an error path.
 */
export function nextAuthSession(session: AuthSession, event: AuthEvent): AuthSession {
  switch (event.type) {
    case 'challenge-issued':
      return canOpenChallenge(session) ? { phase: 'awaiting-code', challenge: event.challenge } : session

    case 'challenge-failed':
      return canOpenChallenge(session) ? { phase: 'failed', failure: 'unreachable' } : session

    case 'code-submitted': {
      if (session.phase !== 'awaiting-code' || !isWellFormedAuthCode(event.code)) return session
      const attempt: AuthAttempt = { challenge: session.challenge, code: event.code }
      return isChallengeExpired(session.challenge, event.at)
        ? { phase: 'failed', failure: 'expired', attempt }
        : { phase: 'verifying', attempt }
    }

    case 'exchange-succeeded':
      return session.phase === 'verifying' ? { phase: 'connected', key: event.key } : session

    case 'exchange-failed':
      return session.phase === 'verifying'
        ? { phase: 'failed', failure: event.failure, attempt: session.attempt }
        : session

    case 'stepped-back':
      return stepBack(session)

    case 'restored':
      return session.phase === 'signed-out' ? { phase: 'connected', key: event.key } : session

    case 'signed-out':
      return session.phase === 'connected' ? { phase: 'signed-out' } : session
  }
}

function canOpenChallenge(session: AuthSession): boolean {
  return (
    session.phase === 'signed-out' ||
    session.phase === 'awaiting-code' ||
    session.phase === 'failed'
  )
}

function stepBack(session: AuthSession): AuthSession {
  switch (session.phase) {
    case 'awaiting-code':
      return { phase: 'signed-out' }
    case 'verifying':
      return { phase: 'awaiting-code', challenge: session.attempt.challenge }
    case 'failed':
      return session.attempt
        ? { phase: 'awaiting-code', challenge: session.attempt.challenge }
        : { phase: 'signed-out' }
    default:
      return session
  }
}
