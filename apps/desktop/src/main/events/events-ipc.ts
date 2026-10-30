import { app, BrowserWindow, ipcMain } from 'electron'
import { authAccessCanWrite } from '@anytype-calendar/auth/domain'
import { toEventsSpan, type EventsEditOutcome } from '@anytype-calendar/events/domain'
import { IpcChannel } from '@shared/ipc'
import type { Auth } from '../auth/compose-auth'
import type { Schema } from '../schema/compose-schema'
import type { Events } from './compose-events'
import { toCreateRequest, toRescheduleRequest, toSetDoneRequest } from './edit-requests'
import { FOCUS_REFRESH_INTERVAL_MS, throttled } from './focus-refresh'

/** Edits need the session's grant, and a focus refresh asks auth and schema again too. */
export type EventsIpcLinks = Pick<Auth, 'authSession' | 'checkAuthAccess'> & Pick<Schema, 'schemaSync'>

export function registerEventsIpc(
  { eventsState, loadEventsSpan, rescheduleEventsObject, createEventsObject, completeEventsObject }: Events,
  { authSession, checkAuthAccess, schemaSync }: EventsIpcLinks
): void {
  const connected = (): boolean => authSession.get().phase === 'connected'

  /* The renderer hides every edit a session cannot make, but it is not trusted to: a key
   * granted read only would have Anytype refuse the write anyway, after the object had been
   * drawn moved. */
  const edit = <T>(parse: (value: unknown) => T | null, run: (request: T) => Promise<EventsEditOutcome>) =>
    (_event: unknown, value: unknown): Promise<EventsEditOutcome> => {
      const request = parse(value)
      if (!request) throw new TypeError('not an edit request')
      const session = authSession.get()
      if (session.phase !== 'connected' || !authAccessCanWrite(session.access)) {
        return Promise.resolve({ ok: false, failure: 'not-granted' })
      }
      return run(request)
    }
  ipcMain.handle(
    IpcChannel.eventsReschedule,
    edit(toRescheduleRequest, (request) => rescheduleEventsObject.execute(request))
  )
  ipcMain.handle(IpcChannel.eventsCreate, edit(toCreateRequest, (request) => createEventsObject.execute(request)))
  ipcMain.handle(
    IpcChannel.eventsSetDone,
    edit(toSetDoneRequest, (request) => completeEventsObject.execute(request))
  )

  ipcMain.handle(IpcChannel.eventsGet, () => eventsState.shown())
  ipcMain.handle(IpcChannel.eventsShowSpan, (_event, value: unknown) => {
    // Renderer input is untrusted, and this one becomes search filters.
    const span = toEventsSpan(value)
    if (!span) throw new TypeError('not a span')
    // Signed out, the span stays idle: a load would only fail for want of a key.
    return connected() ? loadEventsSpan.execute(span) : undefined
  })

  eventsState.subscribe((state) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IpcChannel.eventsChanged, state)
    }
  })

  // Counted from now: the first window takes focus right after launch, when being connected
  // has just read everything. The key's grant is asked again too: the user may have been in
  // Anytype changing it.
  const refresh = throttled(
    () => {
      void checkAuthAccess.execute()
      void schemaSync.execute()
      void loadEventsSpan.execute()
    },
    FOCUS_REFRESH_INTERVAL_MS,
    Date.now,
    Date.now()
  )
  app.on('browser-window-focus', () => {
    if (connected()) refresh()
  })
}
