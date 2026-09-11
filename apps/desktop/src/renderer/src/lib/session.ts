import type { SessionSnapshot } from '@shared/ipc'
import type { AuthView } from '@renderer/types'

/** The only place the renderer reads a session's shape. Null once connected. */
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
    case 'failed':
      return { stage: 'error', failure: session.failure, code: session.attempt?.code }
    case 'connected':
      return null
  }
}
