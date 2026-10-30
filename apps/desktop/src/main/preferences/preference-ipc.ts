import { BrowserWindow, ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc'
import type { Preferences } from './compose-preferences'
import type { Preference } from './preference'

export interface PreferenceChannels {
  get: string
  save: string
  changed: string
}

export function registerPreferenceIpc<T>({ state, parse, save }: Preference<T>, channels: PreferenceChannels): void {
  ipcMain.handle(channels.get, () => state.get())
  ipcMain.handle(channels.save, (_event, value: unknown) => {
    // Renderer input is untrusted, and this one is written to disk.
    const parsed = parse(value)
    if (parsed === undefined) throw new TypeError(`not a value for ${channels.save}`)
    return save(parsed)
  })

  state.subscribe((value) => {
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channels.changed, value)
  })
}

export function registerPreferencesIpc(preferences: Preferences): void {
  registerPreferenceIpc(preferences.theme, {
    get: IpcChannel.themeGet,
    save: IpcChannel.themeSave,
    changed: IpcChannel.themeChanged
  })
  registerPreferenceIpc(preferences.language, {
    get: IpcChannel.languageGet,
    save: IpcChannel.languageSave,
    changed: IpcChannel.languageChanged
  })
  registerPreferenceIpc(preferences.weekNumbers, {
    get: IpcChannel.weekNumbersGet,
    save: IpcChannel.weekNumbersSave,
    changed: IpcChannel.weekNumbersChanged
  })
  registerPreferenceIpc(preferences.calendarVisibility, {
    get: IpcChannel.calendarVisibilityGet,
    save: IpcChannel.calendarVisibilitySave,
    changed: IpcChannel.calendarVisibilityChanged
  })
  registerPreferenceIpc(preferences.weekStart, {
    get: IpcChannel.weekStartGet,
    save: IpcChannel.weekStartSave,
    changed: IpcChannel.weekStartChanged
  })
  registerPreferenceIpc(preferences.timeFormat, {
    get: IpcChannel.timeFormatGet,
    save: IpcChannel.timeFormatSave,
    changed: IpcChannel.timeFormatChanged
  })
  registerPreferenceIpc(preferences.calendarView, {
    get: IpcChannel.calendarViewGet,
    save: IpcChannel.calendarViewSave,
    changed: IpcChannel.calendarViewChanged
  })
}
