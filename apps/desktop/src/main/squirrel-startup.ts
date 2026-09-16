import { spawn } from 'child_process'
import { app } from 'electron'
import { basename, dirname, join } from 'path'

// Squirrel gives its shortcuts the AppUserModelID com.squirrel.<id>.<exe>, where the id is
// package.json's name with `-` swapped for `_` and the exe is forge.config.js's
// executableName. The window must claim the same one, or Windows keeps it apart from them.
export const squirrelAppUserModelId = 'com.squirrel.anytype_calendar_desktop.calendar-for-anytype'

/**
 * Squirrel.Windows launches the app with one of these flags on install, update and
 * uninstall, expecting it to add or remove its shortcuts through Update.exe and quit.
 * Returns whether this launch is one of those.
 */
export function handleSquirrelEvent(): boolean {
  if (process.platform !== 'win32') return false

  const updateShortcuts = (flag: string): void => {
    const updateExe = join(dirname(process.execPath), '..', 'Update.exe')
    spawn(updateExe, [`${flag}=${basename(process.execPath)}`], { detached: true }).on(
      'close',
      () => app.quit()
    )
  }

  switch (process.argv[1]) {
    case '--squirrel-install':
    case '--squirrel-updated':
      updateShortcuts('--createShortcut')
      return true
    case '--squirrel-uninstall':
      updateShortcuts('--removeShortcut')
      return true
    case '--squirrel-obsolete':
      app.quit()
      return true
    default:
      return false
  }
}
