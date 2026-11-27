import { app } from 'electron'
import { UpdateSourceType, updateElectronApp } from 'update-electron-app'
import type { CheckForUpdate } from './check-for-update'
import { RELEASE_REPO } from './latest-release'

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

/**
 * Windows updates itself through update.electronjs.org. That service serves Squirrel only, so
 * the Linux .deb has no updater, and Squirrel.Mac refuses to apply an update to an unsigned
 * app; both are told of a newer release instead, and the user installs it by hand. Once the
 * macOS build is signed it can move back to the updater. An unpackaged app has no installed
 * version to compare against, unless ANYTYPE_CALENDAR_UPDATE_CHECK=1 asks it to check anyway.
 */
export function startUpdates(checkForUpdate: CheckForUpdate): void {
  const forced = process.env.ANYTYPE_CALENDAR_UPDATE_CHECK === '1'
  if (!app.isPackaged && !forced) return

  if (process.platform === 'win32' && !forced) {
    updateElectronApp({
      updateSource: { type: UpdateSourceType.ElectronPublicUpdateService, repo: RELEASE_REPO },
    })
    return
  }

  const check = (): void => {
    checkForUpdate.execute().catch((error: unknown) => {
      console.error('Could not check for a newer release', error)
    })
  }
  check()
  setInterval(check, CHECK_INTERVAL_MS)
}
