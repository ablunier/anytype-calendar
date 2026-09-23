import { BrowserWindow, ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { AppServices } from '../composition'
import { toCalendarView } from './calendar-view-store'

export function registerCalendarViewIpc({
  calendarViewState,
  saveCalendarView
}: AppServices): void {
  ipcMain.handle(IpcChannel.calendarViewGet, () => calendarViewState.get())
  ipcMain.handle(IpcChannel.calendarViewSave, (_event, value: unknown) => {
    // Renderer input is untrusted, and this one is written to disk.
    const view = toCalendarView(value)
    if (view === null) throw new TypeError('not a calendar-view preference')
    return saveCalendarView.execute(view)
  })

  calendarViewState.subscribe((view) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IpcChannel.calendarViewChanged, view)
    }
  })
}
