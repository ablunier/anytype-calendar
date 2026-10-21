import { BrowserWindow, ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { AppServices } from '../composition'
import { toCalendarVisibility } from './calendar-visibility-store'

export function registerCalendarVisibilityIpc({
  calendarVisibilityState,
  saveCalendarVisibility
}: AppServices): void {
  ipcMain.handle(IpcChannel.calendarVisibilityGet, () => calendarVisibilityState.get())
  ipcMain.handle(IpcChannel.calendarVisibilitySave, (_event, value: unknown) => {
    // Renderer input is untrusted, and this one is written to disk.
    const visibility = toCalendarVisibility(value)
    if (visibility === null) throw new TypeError('not a calendar visibility')
    return saveCalendarVisibility.execute(visibility)
  })
  calendarVisibilityState.subscribe((visibility) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IpcChannel.calendarVisibilityChanged, visibility)
    }
  })
}
