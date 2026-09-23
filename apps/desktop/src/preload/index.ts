import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  IpcChannel,
  type CalendarApi,
  type EventsSnapshot,
  type LanguageSnapshot,
  type SchemaSelectionSnapshot,
  type SchemaSnapshot,
  type SessionSnapshot,
  type ThemeSnapshot,
  type TimeFormatSnapshot,
  type WeekNumbersSnapshot,
  type WeekStartSnapshot
} from '@shared/ipc'

const api: CalendarApi = {
  session: {
    get: () => ipcRenderer.invoke(IpcChannel.sessionGet),
    onChange: (listener) => {
      const forward = (_event: IpcRendererEvent, session: SessionSnapshot): void => listener(session)
      ipcRenderer.on(IpcChannel.sessionChanged, forward)
      return () => {
        ipcRenderer.removeListener(IpcChannel.sessionChanged, forward)
      }
    }
  },
  auth: {
    start: () => ipcRenderer.invoke(IpcChannel.authStart),
    submitCode: (code) => ipcRenderer.invoke(IpcChannel.authSubmitCode, code),
    enterKey: () => ipcRenderer.invoke(IpcChannel.authEnterKey),
    submitApiKey: (apiKey) => ipcRenderer.invoke(IpcChannel.authSubmitApiKey, apiKey),
    stepBack: () => ipcRenderer.invoke(IpcChannel.authStepBack),
    signOut: () => ipcRenderer.invoke(IpcChannel.authSignOut),
    copyKey: () => ipcRenderer.invoke(IpcChannel.authCopyKey)
  },
  schema: {
    get: () => ipcRenderer.invoke(IpcChannel.schemaGet),
    onChange: (listener) => {
      const forward = (_event: IpcRendererEvent, state: SchemaSnapshot): void => listener(state)
      ipcRenderer.on(IpcChannel.schemaChanged, forward)
      return () => {
        ipcRenderer.removeListener(IpcChannel.schemaChanged, forward)
      }
    },
    sync: () => ipcRenderer.invoke(IpcChannel.schemaSync)
  },
  schemaSelection: {
    get: () => ipcRenderer.invoke(IpcChannel.schemaSelectionGet),
    onChange: (listener) => {
      const forward = (_event: IpcRendererEvent, state: SchemaSelectionSnapshot): void =>
        listener(state)
      ipcRenderer.on(IpcChannel.schemaSelectionChanged, forward)
      return () => {
        ipcRenderer.removeListener(IpcChannel.schemaSelectionChanged, forward)
      }
    },
    save: (selection) => ipcRenderer.invoke(IpcChannel.schemaSelectionSave, selection)
  },
  events: {
    get: () => ipcRenderer.invoke(IpcChannel.eventsGet),
    onChange: (listener) => {
      const forward = (_event: IpcRendererEvent, state: EventsSnapshot): void => listener(state)
      ipcRenderer.on(IpcChannel.eventsChanged, forward)
      return () => {
        ipcRenderer.removeListener(IpcChannel.eventsChanged, forward)
      }
    },
    showSpan: (span) => ipcRenderer.invoke(IpcChannel.eventsShowSpan, span)
  },
  theme: {
    get: () => ipcRenderer.invoke(IpcChannel.themeGet),
    onChange: (listener) => {
      const forward = (_event: IpcRendererEvent, state: ThemeSnapshot): void => listener(state)
      ipcRenderer.on(IpcChannel.themeChanged, forward)
      return () => {
        ipcRenderer.removeListener(IpcChannel.themeChanged, forward)
      }
    },
    save: (theme) => ipcRenderer.invoke(IpcChannel.themeSave, theme)
  },
  language: {
    get: () => ipcRenderer.invoke(IpcChannel.languageGet),
    onChange: (listener) => {
      const forward = (_event: IpcRendererEvent, state: LanguageSnapshot): void => listener(state)
      ipcRenderer.on(IpcChannel.languageChanged, forward)
      return () => {
        ipcRenderer.removeListener(IpcChannel.languageChanged, forward)
      }
    },
    save: (language) => ipcRenderer.invoke(IpcChannel.languageSave, language)
  },
  weekNumbers: {
    get: () => ipcRenderer.invoke(IpcChannel.weekNumbersGet),
    onChange: (listener) => {
      const forward = (_event: IpcRendererEvent, shown: WeekNumbersSnapshot): void =>
        listener(shown)
      ipcRenderer.on(IpcChannel.weekNumbersChanged, forward)
      return () => {
        ipcRenderer.removeListener(IpcChannel.weekNumbersChanged, forward)
      }
    },
    save: (shown) => ipcRenderer.invoke(IpcChannel.weekNumbersSave, shown)
  },
  weekStart: {
    get: () => ipcRenderer.invoke(IpcChannel.weekStartGet),
    onChange: (listener) => {
      const forward = (_event: IpcRendererEvent, day: WeekStartSnapshot): void => listener(day)
      ipcRenderer.on(IpcChannel.weekStartChanged, forward)
      return () => {
        ipcRenderer.removeListener(IpcChannel.weekStartChanged, forward)
      }
    },
    save: (day) => ipcRenderer.invoke(IpcChannel.weekStartSave, day)
  },
  timeFormat: {
    get: () => ipcRenderer.invoke(IpcChannel.timeFormatGet),
    onChange: (listener) => {
      const forward = (_event: IpcRendererEvent, format: TimeFormatSnapshot): void =>
        listener(format)
      ipcRenderer.on(IpcChannel.timeFormatChanged, forward)
      return () => {
        ipcRenderer.removeListener(IpcChannel.timeFormatChanged, forward)
      }
    },
    save: (format) => ipcRenderer.invoke(IpcChannel.timeFormatSave, format)
  },
  shell: {
    openObject: (objectId, spaceId) =>
      ipcRenderer.invoke(IpcChannel.shellOpenObject, objectId, spaceId)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.api = api
}
