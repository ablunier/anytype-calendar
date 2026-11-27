import { IpcChannel } from '@shared/ipc'
import type { CalendarIpcRegistrar } from '../platform'
import type { Preferences } from './compose-preferences'
import type { Preference } from './preference'

export interface PreferenceChannels {
  get: string
  save: string
  changed: string
}

export function registerPreferenceIpc<State, Saved extends State>(
  ipc: CalendarIpcRegistrar,
  { state, parse, save }: Preference<State, Saved>,
  channels: PreferenceChannels,
): void {
  ipc.handle(channels.get, () => state.get())
  ipc.handle(channels.save, (_event, value: unknown) => {
    // Renderer input is untrusted, and this one is written to disk.
    const parsed = parse(value)
    if (parsed === undefined) throw new TypeError(`not a value for ${channels.save}`)
    return save(parsed)
  })

  state.subscribe((value) => ipc.broadcast(channels.changed, value))
}

export function registerPreferencesIpc(ipc: CalendarIpcRegistrar, preferences: Preferences): void {
  registerPreferenceIpc(ipc, preferences.theme, {
    get: IpcChannel.themeGet,
    save: IpcChannel.themeSave,
    changed: IpcChannel.themeChanged,
  })
  registerPreferenceIpc(ipc, preferences.language, {
    get: IpcChannel.languageGet,
    save: IpcChannel.languageSave,
    changed: IpcChannel.languageChanged,
  })
  registerPreferenceIpc(ipc, preferences.weekNumbers, {
    get: IpcChannel.weekNumbersGet,
    save: IpcChannel.weekNumbersSave,
    changed: IpcChannel.weekNumbersChanged,
  })
  registerPreferenceIpc(ipc, preferences.calendarVisibility, {
    get: IpcChannel.calendarVisibilityGet,
    save: IpcChannel.calendarVisibilitySave,
    changed: IpcChannel.calendarVisibilityChanged,
  })
  registerPreferenceIpc(ipc, preferences.weekStart, {
    get: IpcChannel.weekStartGet,
    save: IpcChannel.weekStartSave,
    changed: IpcChannel.weekStartChanged,
  })
  registerPreferenceIpc(ipc, preferences.timeFormat, {
    get: IpcChannel.timeFormatGet,
    save: IpcChannel.timeFormatSave,
    changed: IpcChannel.timeFormatChanged,
  })
  registerPreferenceIpc(ipc, preferences.calendarView, {
    get: IpcChannel.calendarViewGet,
    save: IpcChannel.calendarViewSave,
    changed: IpcChannel.calendarViewChanged,
  })
  registerPreferenceIpc(ipc, preferences.agendaDays, {
    get: IpcChannel.agendaDaysGet,
    save: IpcChannel.agendaDaysSave,
    changed: IpcChannel.agendaDaysChanged,
  })
}
