import { app } from 'electron'
import { updateElectronApp, UpdateSourceType } from 'update-electron-app'

// update.electronjs.org serves Squirrel.Windows and Squirrel.Mac only, so the Linux .deb
// has no updater, and an unpackaged app has no installed version to compare against.
export function startAutoUpdate(): void {
  if (!app.isPackaged) return
  if (process.platform !== 'win32' && process.platform !== 'darwin') return

  updateElectronApp({
    updateSource: {
      type: UpdateSourceType.ElectronPublicUpdateService,
      repo: 'ablunier/anytype-calendar'
    }
  })
}
