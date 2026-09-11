import type { AuthSession } from '@anytype-calendar/auth/domain'

/** Safe to hand to the renderer: an AuthSession never carries the API key. */
export type SessionSnapshot = AuthSession

export const IpcChannel = {
  sessionGet: 'session:get',
  sessionChanged: 'session:changed',
  authStart: 'auth:start',
  authSubmitCode: 'auth:submit-code',
  authStepBack: 'auth:step-back',
  authSignOut: 'auth:sign-out',
  authRevoke: 'auth:revoke',
  devForceSession: 'dev:force-session'
} as const

/** What the preload exposes to the renderer as `window.api`. */
export interface CalendarApi {
  session: {
    get(): Promise<SessionSnapshot>
    onChange(listener: (session: SessionSnapshot) => void): () => void
  }
  auth: {
    start(): Promise<void>
    submitCode(code: string): Promise<void>
    stepBack(): Promise<void>
    signOut(): Promise<void>
    /** Rejects, leaving the session connected, when Anytype cannot be reached. */
    revoke(): Promise<void>
  }
  dev: {
    /** Rejects outside development: main registers no handler there. */
    forceSession(session: SessionSnapshot): Promise<void>
  }
}
