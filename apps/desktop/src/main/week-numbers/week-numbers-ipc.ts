import { BrowserWindow, ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { AppServices } from '../composition'
import { toWeekNumbers } from './week-numbers-store'

export function registerWeekNumbersIpc({ weekNumbersState, saveWeekNumbers }: AppServices): void {
  ipcMain.handle(IpcChannel.weekNumbersGet, () => weekNumbersState.get())
  ipcMain.handle(IpcChannel.weekNumbersSave, (_event, value: unknown) => {
    // Renderer input is untrusted, and this one is written to disk.
    const shown = toWeekNumbers(value)
    if (shown === null) throw new TypeError('not a week-numbers preference')
    return saveWeekNumbers.execute(shown)
  })

  weekNumbersState.subscribe((shown) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IpcChannel.weekNumbersChanged, shown)
    }
  })
}
