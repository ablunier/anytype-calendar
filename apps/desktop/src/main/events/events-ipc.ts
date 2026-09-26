import { app, BrowserWindow, ipcMain } from 'electron'
import { toEventsSpan } from '@anytype-calendar/events/domain'
import { IpcChannel } from '@shared/ipc'
import type { AppServices } from '../composition'
import { FOCUS_REFRESH_INTERVAL_MS, throttled } from './focus-refresh'

export function registerEventsIpc({
  authSession,
  checkAuthAccess,
  schemaSync,
  eventsState,
  loadEventsSpan
}: AppServices): void {
  const connected = (): boolean => authSession.get().phase === 'connected'

  ipcMain.handle(IpcChannel.eventsGet, () => eventsState.get())
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
