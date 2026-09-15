import { ipcMain, shell } from 'electron'
import { IpcChannel } from '@shared/ipc'

export function registerShellIpc(): void {
  ipcMain.handle(IpcChannel.shellOpenObject, (_event, objectId: unknown, spaceId: unknown) => {
    // Renderer input is untrusted, and this one is handed to the OS via openExternal.
    if (typeof objectId !== 'string' || typeof spaceId !== 'string') {
      throw new TypeError('objectId and spaceId must be strings')
    }
    const url = `anytype://object?objectId=${encodeURIComponent(objectId)}&spaceId=${encodeURIComponent(spaceId)}`
    return shell.openExternal(url)
  })
}
