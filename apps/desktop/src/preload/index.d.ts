import type { ElectronAPI } from '@electron-toolkit/preload'
import type { CalendarApi } from '@shared/ipc'

declare global {
  interface Window {
    electron: ElectronAPI
    api: CalendarApi
  }
}
