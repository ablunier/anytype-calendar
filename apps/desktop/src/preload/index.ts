import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IpcChannel, type CalendarApi, type SessionSnapshot } from '@shared/ipc'

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
    stepBack: () => ipcRenderer.invoke(IpcChannel.authStepBack),
    signOut: () => ipcRenderer.invoke(IpcChannel.authSignOut),
    revoke: () => ipcRenderer.invoke(IpcChannel.authRevoke),
    copyKey: () => ipcRenderer.invoke(IpcChannel.authCopyKey)
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
