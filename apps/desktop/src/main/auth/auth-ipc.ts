import { BrowserWindow, clipboard, ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { AppServices } from '../composition'

export function registerAuthIpc({
  authSession,
  startAuthConnection,
  submitAuthCode,
  stepBackAuthConnection,
  signOutOfAuth,
  copyAuthApiKey
}: AppServices): void {
  ipcMain.handle(IpcChannel.sessionGet, () => authSession.get())
  ipcMain.handle(IpcChannel.authStart, () => startAuthConnection.execute())
  ipcMain.handle(IpcChannel.authSubmitCode, (_event, code: unknown) => {
    // Renderer input is untrusted; the domain ignores a malformed code, but not a non-string.
    if (typeof code !== 'string') throw new TypeError('auth code must be a string')
    return submitAuthCode.execute(code)
  })
  ipcMain.handle(IpcChannel.authStepBack, () => stepBackAuthConnection.execute())
  ipcMain.handle(IpcChannel.authSignOut, () => signOutOfAuth.execute())
  ipcMain.handle(IpcChannel.authCopyKey, () =>
    copyAuthApiKey.execute((apiKey) => clipboard.writeText(apiKey))
  )

  authSession.subscribe((session) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IpcChannel.sessionChanged, session)
    }
  })
}
