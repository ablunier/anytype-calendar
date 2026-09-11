import { BrowserWindow, clipboard, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import { IpcChannel, type SessionSnapshot } from '@shared/ipc'
import type { AppServices } from '../composition'

export function registerAuthIpc({ authService, authSession }: AppServices): void {
  ipcMain.handle(IpcChannel.sessionGet, () => authSession.get())
  ipcMain.handle(IpcChannel.authStart, () => authService.startConnection())
  ipcMain.handle(IpcChannel.authSubmitCode, (_event, code: unknown) => {
    // Renderer input is untrusted; the domain ignores a malformed code, but not a non-string.
    if (typeof code !== 'string') throw new TypeError('auth code must be a string')
    return authService.submitCode(code)
  })
  ipcMain.handle(IpcChannel.authStepBack, () => authService.stepBack())
  ipcMain.handle(IpcChannel.authSignOut, () => authService.signOut())
  ipcMain.handle(IpcChannel.authRevoke, () => authService.revoke())
  ipcMain.handle(IpcChannel.authCopyKey, () =>
    authService.copyKeyTo((apiKey) => clipboard.writeText(apiKey))
  )

  authSession.subscribe((session) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IpcChannel.sessionChanged, session)
    }
  })

  if (is.dev) {
    ipcMain.handle(IpcChannel.devForceSession, (_event, session: SessionSnapshot) =>
      authSession.set(session)
    )
  }
}
