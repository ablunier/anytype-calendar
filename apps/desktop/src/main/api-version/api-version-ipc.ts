import { BrowserWindow, ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { AppServices } from '../composition'
import { toApiVersion } from './api-version-store'

export function registerApiVersionIpc({ apiVersionState, saveApiVersion }: AppServices): void {
  ipcMain.handle(IpcChannel.apiVersionGet, () => apiVersionState.get())
  ipcMain.handle(IpcChannel.apiVersionSave, (_event, value: unknown) => {
    // Renderer input is untrusted, and this one is written to disk.
    const preference = toApiVersion(value)
    if (preference === null) throw new TypeError('not an API-version preference')
    return saveApiVersion.execute(preference)
  })

  apiVersionState.subscribe((preference) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IpcChannel.apiVersionChanged, preference)
    }
  })
}
