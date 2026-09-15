import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  IpcChannel,
  type CalendarApi,
  type EventsSnapshot,
  type SchemaSelectionSnapshot,
  type SchemaSnapshot,
  type SessionSnapshot,
  type ThemeSnapshot
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
    showMonth: (month) => ipcRenderer.invoke(IpcChannel.eventsShowMonth, month)
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
