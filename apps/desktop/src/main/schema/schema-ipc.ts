import { BrowserWindow, ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { AppServices } from '../composition'

export function registerSchemaIpc({ schemaSync, schemaState }: AppServices): void {
  ipcMain.handle(IpcChannel.schemaGet, () => schemaState.get())
  ipcMain.handle(IpcChannel.schemaSync, () => schemaSync.sync())

  schemaState.subscribe((state) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IpcChannel.schemaChanged, state)
    }
  })
}
