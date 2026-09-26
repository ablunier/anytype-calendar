import { sameAuthAccess, type AuthAccess } from './access'
import { isChallengeExpired, isWellFormedAuthCode, type AuthChallenge } from './challenge'
import type { ApiKeyInfo } from './credential'

export type AuthFailure =
  | 'invalid-code'
  | 'expired'
  /** Usually the Anytype desktop app is not running. */
  | 'unreachable'
  /** A pasted key Anytype does not recognise. */
  | 'invalid-key'

/** Grouped so a code never appears without the challenge it was submitted against. */
export interface AuthAttempt {
  challenge: AuthChallenge
  code: string
}

/**
 * Holds no secret — a connected session carries only ApiKeyInfo, never the key, and
 * `entering-key`/`verifying-key` hold none of the pasted key either — so it can be handed
 * to any process that needs to draw it.
 */
export type AuthSession =
  | { phase: 'signed-out' }
  | { phase: 'awaiting-code'; challenge: AuthChallenge }
  | { phase: 'verifying'; attempt: AuthAttempt }
  /** The user chose to paste a key they already hold instead of the code exchange. */
  | { phase: 'entering-key' }
  | { phase: 'verifying-key' }
  /**
   * `attempt` is absent when no challenge could be opened, or the failure came from the
   * key path. `enteredKey` marks that latter case, so stepping back returns to pasting a
   * key rather than to a code challenge.
   */
  | { phase: 'failed'; failure: AuthFailure; attempt?: AuthAttempt; enteredKey?: boolean }
  /**
   * `access` is null until Anytype has been asked: a key restored at launch is connected
   * before anything is read.
   */
  | { phase: 'connected'; key: ApiKeyInfo; access: AuthAccess | null }

export type AuthSessionPhase = AuthSession['phase']

export type AuthEvent =
  | { type: 'challenge-issued'; challenge: AuthChallenge }
  /** Opening a challenge can only fail by Anytype being unreachable. */
  | { type: 'challenge-failed' }
  /** `at` decides whether the code arrived before its challenge expired. */
  | { type: 'code-submitted'; code: string; at: number }
  | { type: 'exchange-succeeded'; key: ApiKeyInfo; access: AuthAccess }
  | { type: 'exchange-failed'; failure: AuthFailure }
  /** The user picked "I already have an API key" from the start screen. */
  | { type: 'key-entry-opened' }
  | { type: 'key-submitted' }
  | { type: 'key-verified'; key: ApiKeyInfo; access: AuthAccess }
  | { type: 'key-rejected'; failure: AuthFailure }
  | { type: 'stepped-back' }
  | { type: 'restored'; key: ApiKeyInfo }
  | { type: 'signed-out' }
  /** Anytype was asked again what the connected key reaches, e.g. when the window regains focus. */
  | { type: 'access-checked'; access: AuthAccess }

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
      return session.phase === 'verifying'
        ? { phase: 'connected', key: event.key, access: event.access }
        : session

    case 'exchange-failed':
      return session.phase === 'verifying'
        ? { phase: 'failed', failure: event.failure, attempt: session.attempt }
        : session

    case 'key-entry-opened':
      return session.phase === 'signed-out' ? { phase: 'entering-key' } : session

    case 'key-submitted':
      return session.phase === 'entering-key' ? { phase: 'verifying-key' } : session

    case 'key-verified':
      return session.phase === 'verifying-key'
        ? { phase: 'connected', key: event.key, access: event.access }
        : session

    case 'key-rejected':
      return session.phase === 'verifying-key'
        ? { phase: 'failed', failure: event.failure, enteredKey: true }
        : session

    case 'stepped-back':
      return stepBack(session)

    case 'restored':
      return session.phase === 'signed-out'
        ? { phase: 'connected', key: event.key, access: null }
        : session

    case 'signed-out':
      return session.phase === 'connected' ? { phase: 'signed-out' } : session

    case 'access-checked':
      return session.phase === 'connected' &&
        (session.access === null || !sameAuthAccess(session.access, event.access))
        ? { ...session, access: event.access }
        : session
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
    case 'entering-key':
      return { phase: 'signed-out' }
    case 'verifying-key':
      return { phase: 'entering-key' }
    case 'failed':
      if (session.enteredKey) return { phase: 'entering-key' }
      return session.attempt
        ? { phase: 'awaiting-code', challenge: session.attempt.challenge }
        : { phase: 'signed-out' }
    default:
      return session
  }
}
