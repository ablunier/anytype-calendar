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
  ipcMain.handle(IpcChannel.shellOpenLink, (_event, url: unknown) => {
    // The link comes from a subscribed feed, which anyone may have written: only a web page
    // is opened, never a file or another app's scheme.
    if (typeof url !== 'string' || !/^https?:\/\/\S+$/i.test(url)) throw new TypeError('not a web link')
    return shell.openExternal(url)
  })
}
