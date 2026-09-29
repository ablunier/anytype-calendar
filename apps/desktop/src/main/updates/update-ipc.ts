import { BrowserWindow, ipcMain, shell } from 'electron'
import { IpcChannel, type UpdateSnapshot } from '@shared/ipc'
import type { AppServices } from '../composition'
import type { UpdateNotice } from './update-notice-store'

/** The release page's URL stays in main, so the renderer can open nothing but that page. */
function snapshotOf({ current, available, dismissed }: UpdateNotice): UpdateSnapshot {
  return { current, available: available?.version ?? null, dismissed }
}

export function registerUpdateIpc({ updateNotice, dismissUpdateNotice }: AppServices): void {
  ipcMain.handle(IpcChannel.updateGet, () => snapshotOf(updateNotice.get()))
  ipcMain.handle(IpcChannel.updateDismiss, () => dismissUpdateNotice.execute())
  ipcMain.handle(IpcChannel.updateOpenRelease, async () => {
    const release = updateNotice.get().available
    if (release) await shell.openExternal(release.url)
  })

  updateNotice.subscribe((notice) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IpcChannel.updateChanged, snapshotOf(notice))
    }
  })
}
