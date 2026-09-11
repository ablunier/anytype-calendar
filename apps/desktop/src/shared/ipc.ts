import type { AuthSession } from '@anytype-calendar/auth/domain'
import type {
  SchemaSelection,
  SchemaSelectionState,
  SchemaSync
} from '@anytype-calendar/schema/domain'

/** Safe to hand to the renderer: an AuthSession never carries the API key. */
export type SessionSnapshot = AuthSession

/** Safe to hand to the renderer: the key is read in main and never stored in a SchemaSync. */
export type SchemaSnapshot = SchemaSync

export type SchemaSelectionSnapshot = SchemaSelectionState

export const IpcChannel = {
  sessionGet: 'session:get',
  sessionChanged: 'session:changed',
  authStart: 'auth:start',
  authSubmitCode: 'auth:submit-code',
  authStepBack: 'auth:step-back',
  authSignOut: 'auth:sign-out',
  authCopyKey: 'auth:copy-key',
  schemaGet: 'schema:get',
  schemaChanged: 'schema:changed',
  schemaSync: 'schema:sync',
  schemaSelectionGet: 'schema-selection:get',
  schemaSelectionChanged: 'schema-selection:changed',
  schemaSelectionSave: 'schema-selection:save'
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
    /**
     * Main writes the key to the clipboard, so it never reaches the renderer. Resolves
     * whether there was a key to copy.
     */
    copyKey(): Promise<boolean>
  }
  schema: {
    get(): Promise<SchemaSnapshot>
    onChange(listener: (state: SchemaSnapshot) => void): () => void
    /** Main already syncs on every sign-in; this asks again, e.g. after a failure. */
    sync(): Promise<void>
  }
  schemaSelection: {
    get(): Promise<SchemaSelectionSnapshot>
    onChange(listener: (state: SchemaSelectionSnapshot) => void): () => void
    /** Rejects when the selection is malformed or could not be written. */
    save(selection: SchemaSelection): Promise<void>
  }
}
