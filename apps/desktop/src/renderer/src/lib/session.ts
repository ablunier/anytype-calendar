/* The only renderer module that reads a session's shape; components get view models. */

import { authAccessCanWrite } from '@anytype-calendar/auth/domain'
import type { SessionSnapshot } from '@shared/ipc'
import type { ApiAccessView, ApiKeyView, AuthView, EditAccess } from '@renderer/types'

/** Null once connected. */
export function authViewFor(session: SessionSnapshot): AuthView | null {
  switch (session.phase) {
    case 'signed-out':
      return { stage: 'start' }
    case 'awaiting-code':
      return {
        stage: 'code',
        challengeId: session.challenge.id,
        expiresAt: session.challenge.expiresAt
      }
    case 'verifying':
      return { stage: 'verifying', code: session.attempt.code }
    case 'entering-key':
      return { stage: 'entering-key' }
    case 'verifying-key':
      return { stage: 'verifying-key' }
    case 'failed':
      return {
        stage: 'error',
        failure: session.failure,
        code: session.attempt?.code,
        origin: session.enteredKey ? 'key' : 'code'
      }
    case 'connected':
      return null
  }
}

/** Null until connected. */
export function apiKeyFor(session: SessionSnapshot): ApiKeyView | null {
  return session.phase === 'connected'
    ? { hint: session.key.hint, issuedAt: session.key.issuedAt }
    : null
}

/** Null until connected, and until Anytype has been asked what a restored key reaches. */
export function apiAccessFor(session: SessionSnapshot): ApiAccessView | null {
  if (session.phase !== 'connected' || session.access === null) return null
  const { grant } = session.access
  if (grant === null) return { spaceCount: null, canEdit: true }
  return {
    spaceCount: grant.allSpaces ? null : grant.spaceIds.length,
    canEdit: grant.permission === 'readwrite'
  }
}

export function editAccessFor(session: SessionSnapshot): EditAccess {
  if (session.phase !== 'connected' || session.access === null) return 'checking'
  return authAccessCanWrite(session.access) ? 'editable' : 'read-only'
}
