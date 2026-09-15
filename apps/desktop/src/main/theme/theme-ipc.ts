import { BrowserWindow, ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { AppServices } from '../composition'
import { toTheme } from './theme-store'

export function registerThemeIpc({ themeState, saveTheme }: AppServices): void {
  ipcMain.handle(IpcChannel.themeGet, () => themeState.get())
  ipcMain.handle(IpcChannel.themeSave, (_event, value: unknown) => {
    // Renderer input is untrusted, and this one is written to disk.
    const theme = toTheme(value)
    if (!theme) throw new TypeError('not a theme')
    return saveTheme.execute(theme)
  })

  themeState.subscribe((state) => broadcast(IpcChannel.themeChanged, state))
}

function broadcast(channel: string, state: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, state)
}
