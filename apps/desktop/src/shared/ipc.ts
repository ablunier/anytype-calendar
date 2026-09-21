import type { AuthSession } from '@anytype-calendar/auth/domain'
import type { EventsMonth, EventsMonthLoad } from '@anytype-calendar/events/domain'
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

/** Safe to hand to the renderer: the key is read in main and never stored in an EventsMonthLoad. */
export type EventsSnapshot = EventsMonthLoad

/** Null: no theme was ever saved, so the renderer follows the OS setting. */
export type ThemeSnapshot = 'light' | 'dark' | null

export type WeekNumbersSnapshot = boolean

/** Monday is 0, Sunday 6. */
export type WeekStartSnapshot = number

export type TimeFormatSnapshot = '24h' | '12h'

export const IpcChannel = {
  sessionGet: 'session:get',
  sessionChanged: 'session:changed',
  authStart: 'auth:start',
  authSubmitCode: 'auth:submit-code',
  authEnterKey: 'auth:enter-key',
  authSubmitApiKey: 'auth:submit-api-key',
  authStepBack: 'auth:step-back',
  authSignOut: 'auth:sign-out',
  authCopyKey: 'auth:copy-key',
  schemaGet: 'schema:get',
  schemaChanged: 'schema:changed',
  schemaSync: 'schema:sync',
  schemaSelectionGet: 'schema-selection:get',
  schemaSelectionChanged: 'schema-selection:changed',
  schemaSelectionSave: 'schema-selection:save',
  eventsGet: 'events:get',
  eventsChanged: 'events:changed',
  eventsShowMonth: 'events:show-month',
  themeGet: 'theme:get',
  themeChanged: 'theme:changed',
  themeSave: 'theme:save',
  weekNumbersGet: 'weekNumbers:get',
  weekNumbersChanged: 'weekNumbers:changed',
  weekNumbersSave: 'weekNumbers:save',
  weekStartGet: 'weekStart:get',
  weekStartChanged: 'weekStart:changed',
  weekStartSave: 'weekStart:save',
  timeFormatGet: 'timeFormat:get',
  timeFormatChanged: 'timeFormat:changed',
  timeFormatSave: 'timeFormat:save',
  shellOpenObject: 'shell:open-object'
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
    /** Switches the start screen to pasting a key the user already holds. */
    enterKey(): Promise<void>
    submitApiKey(apiKey: string): Promise<void>
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
  events: {
    get(): Promise<EventsSnapshot>
    onChange(listener: (state: EventsSnapshot) => void): () => void
    /**
     * Loads the month, or reads it again when it is the one shown. Main already loads on
     * sign-in, on every read of the account and every saved selection. Rejects when the month
     * is malformed; does nothing while signed out.
     */
    showMonth(month: EventsMonth): Promise<void>
  }
  theme: {
    get(): Promise<ThemeSnapshot>
    onChange(listener: (state: ThemeSnapshot) => void): () => void
    /** Rejects when the value is not a theme. */
    save(theme: 'light' | 'dark'): Promise<void>
  }
  weekNumbers: {
    get(): Promise<WeekNumbersSnapshot>
    onChange(listener: (shown: WeekNumbersSnapshot) => void): () => void
    /** Rejects when the value is not a boolean. */
    save(shown: boolean): Promise<void>
  }
  weekStart: {
    get(): Promise<WeekStartSnapshot>
    onChange(listener: (day: WeekStartSnapshot) => void): () => void
    /** Rejects when the value is not an integer from 0 to 6. */
    save(day: WeekStartSnapshot): Promise<void>
  }
  timeFormat: {
    get(): Promise<TimeFormatSnapshot>
    onChange(listener: (format: TimeFormatSnapshot) => void): () => void
    /** Rejects when the value is not `24h` or `12h`. */
    save(format: TimeFormatSnapshot): Promise<void>
  }
  shell: {
    /** Opens the object in the Anytype desktop app via its `anytype://object` deep link. */
    openObject(objectId: string, spaceId: string): Promise<void>
  }
}
