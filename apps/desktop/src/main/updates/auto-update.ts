import { app } from 'electron'
import { updateElectronApp, UpdateSourceType } from 'update-electron-app'
import type { CheckForUpdate } from './check-for-update'
import { toLatestRelease, type LatestRelease } from './release-version'

const REPO = 'ablunier/anytype-calendar'
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const CHECK_TIMEOUT_MS = 15_000

/**
 * Windows updates itself through update.electronjs.org. That service serves Squirrel only, so
 * the Linux .deb has no updater, and Squirrel.Mac refuses to apply an update to an unsigned
 * app; both are told of a newer release instead, and the user installs it by hand. Once the
 * macOS build is signed it can move back to the updater. An unpackaged app has no installed
 * version to compare against, unless ANYTYPE_CALENDAR_UPDATE_CHECK=1 asks it to check anyway.
 */
export function startUpdates(checkForUpdate: CheckForUpdate): void {
  const forced = process.env['ANYTYPE_CALENDAR_UPDATE_CHECK'] === '1'
  if (!app.isPackaged && !forced) return

  if (process.platform === 'win32' && !forced) {
    updateElectronApp({
      updateSource: { type: UpdateSourceType.ElectronPublicUpdateService, repo: REPO }
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

/**
 * GitHub's latest release, which is never a draft or a prerelease. Unauthenticated, this is
 * allowed 60 requests an hour per address, far more than a check every few hours needs.
 */
export async function fetchLatestRelease(): Promise<LatestRelease | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'anytype-calendar' },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS)
    })
    if (!response.ok) return null
    return toLatestRelease(await response.json())
  } catch {
    return null
  }
}
