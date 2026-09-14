import { app, BrowserWindow, ipcMain } from 'electron'
import { toEventsMonth } from '@anytype-calendar/events/domain'
import { IpcChannel } from '@shared/ipc'
import type { AppServices } from '../composition'
import { FOCUS_REFRESH_INTERVAL_MS, throttled } from './focus-refresh'

export function registerEventsIpc({
  authSession,
  schemaSync,
  eventsState,
  loadEventsMonth
}: AppServices): void {
  const connected = (): boolean => authSession.get().phase === 'connected'

  ipcMain.handle(IpcChannel.eventsGet, () => eventsState.get())
  ipcMain.handle(IpcChannel.eventsShowMonth, (_event, value: unknown) => {
    // Renderer input is untrusted, and this one becomes search filters.
    const month = toEventsMonth(value)
    if (!month) throw new TypeError('not a month')
    // Signed out, the month stays idle: a load would only fail for want of a key.
    return connected() ? loadEventsMonth.execute(month) : undefined
  })

  eventsState.subscribe((state) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IpcChannel.eventsChanged, state)
    }
  })

  // Counted from now: the first window takes focus right after launch, when being connected
  // has just read everything.
  const refresh = throttled(
    () => {
      void schemaSync.execute()
      void loadEventsMonth.execute()
    },
    FOCUS_REFRESH_INTERVAL_MS,
    Date.now,
    Date.now()
  )
  app.on('browser-window-focus', () => {
    if (connected()) refresh()
  })
}
