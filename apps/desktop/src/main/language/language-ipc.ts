import { BrowserWindow, ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { AppServices } from '../composition'
import { toLanguage } from './language-store'

export function registerLanguageIpc({ languageState, saveLanguage }: AppServices): void {
  ipcMain.handle(IpcChannel.languageGet, () => languageState.get())
  ipcMain.handle(IpcChannel.languageSave, (_event, value: unknown) => {
    // Renderer input is untrusted, and this one is written to disk.
    const language = toLanguage(value)
    if (language === undefined) throw new TypeError('not a language')
    return saveLanguage.execute(language)
  })

  languageState.subscribe((state) => broadcast(IpcChannel.languageChanged, state))
}

function broadcast(channel: string, state: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, state)
}
