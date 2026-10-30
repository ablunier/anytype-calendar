import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAuthIpc } from './auth/auth-ipc'
import { composeServices } from './composition'
import { registerEventsIpc } from './events/events-ipc'
import { registerFeedsIpc } from './feeds/feeds-ipc'
import { registerPreferencesIpc } from './preferences/preference-ipc'
import { registerSchemaIpc } from './schema/schema-ipc'
import { registerShellIpc } from './shell/shell-ipc'
import { handleSquirrelEvent, squirrelAppUserModelId } from './squirrel-startup'
import { startUpdates } from './updates/auto-update'
import { registerUpdateIpc } from './updates/update-ipc'
import icon from '../../resources/icon.png?asset'

const isSquirrelEvent = handleSquirrelEvent()

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    // macOS and Windows use the packaged app icon (build/icon.*) in dev too; only Linux
    // needs the window icon set explicitly.
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  // The app is only quitting once Update.exe has done its shortcuts.
  if (isSquirrelEvent) return

  electronApp.setAppUserModelId(squirrelAppUserModelId)

  const services = composeServices()
  registerAuthIpc(services)
  registerSchemaIpc(services)
  registerEventsIpc(services)
  registerFeedsIpc(services)
  registerPreferencesIpc(services.preferences)
  registerShellIpc()
  registerUpdateIpc(services)
  // The span a launch opens on is read from these two, and restoring the session is what
  // starts that first load, so they have to be in place before it runs. The feeds are drawn
  // over that span too, before Anytype has been asked anything.
  await Promise.all([services.preferences.calendarView.load(), services.preferences.weekStart.load()])
  services.showFeedsForSpan()
  // All settle before the first window asks, so it never draws a state about to change.
  await Promise.all([
    services.restoreAuthSession.execute(),
    services.loadSchemaSelection.execute(),
    services.preferences.theme.load(),
    services.preferences.language.load(),
    services.preferences.weekNumbers.load(),
    services.preferences.calendarVisibility.load(),
    services.preferences.timeFormat.load(),
    // Only the copies cached at the last read: the network is asked once a window is open.
    services.loadFeeds.execute()
  ])

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  startUpdates(services.checkForUpdate)
  void services.refreshFeeds.execute()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
