import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, clipboard, ipcMain, safeStorage, shell } from 'electron'
import icon from '../../resources/icon.png?asset'
import { registerAuthIpc } from './auth/auth-ipc'
import { composeServices } from './composition'
import { registerEventsIpc } from './events/events-ipc'
import { registerFeedsIpc } from './feeds/feeds-ipc'
import type { CalendarIpcRegistrar, CalendarPlatform } from './platform'
import { registerPreferencesIpc } from './preferences/preference-ipc'
import { registerSchemaIpc } from './schema/schema-ipc'
import { registerShellIpc } from './shell/shell-ipc'
import { handleSquirrelEvent, squirrelAppUserModelId } from './squirrel-startup'
import { startUpdates } from './updates/auto-update'
import { registerUpdateIpc } from './updates/update-ipc'

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
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/** Read once the app is ready: safeStorage needs that. */
function electronPlatform(): CalendarPlatform {
  return {
    userDataPath: app.getPath('userData'),
    appVersion: app.getVersion(),
    os: process.platform,
    encryption: {
      isAvailable: () => safeStorage.isEncryptionAvailable(),
      selectedBackend: () => safeStorage.getSelectedStorageBackend(),
      encrypt: (plain) => safeStorage.encryptString(plain),
      decrypt: (sealed) => safeStorage.decryptString(sealed),
    },
  }
}

function electronIpcRegistrar(): CalendarIpcRegistrar {
  return {
    handle: (channel, handler) => ipcMain.handle(channel, handler),
    broadcast: (channel, payload) => {
      for (const window of BrowserWindow.getAllWindows()) window.webContents.send(channel, payload)
    },
    onWindowFocus: (listener) => app.on('browser-window-focus', listener),
  }
}

app.whenReady().then(async () => {
  // The app is only quitting once Update.exe has done its shortcuts.
  if (isSquirrelEvent) return

  electronApp.setAppUserModelId(squirrelAppUserModelId)

  const { auth, schema, events, feeds, preferences, updates } = composeServices(electronPlatform())
  const ipc = electronIpcRegistrar()
  registerAuthIpc(ipc, (text) => clipboard.writeText(text), auth)
  registerSchemaIpc(ipc, schema)
  registerEventsIpc(ipc, events, { ...auth, ...schema })
  registerFeedsIpc(ipc, feeds)
  registerPreferencesIpc(ipc, preferences)
  registerShellIpc(ipc, (url) => shell.openExternal(url))
  registerUpdateIpc(ipc, (url) => shell.openExternal(url), updates)
  // The span a launch opens on is read from these three, and restoring the session is what
  // starts that first load, so they have to be in place before it runs. The feeds are drawn
  // over that span too, before Anytype has been asked anything.
  await Promise.all([preferences.calendarView.load(), preferences.weekStart.load(), preferences.agendaDays.load()])
  feeds.showFeedsForSpan()
  // All settle before the first window asks, so it never draws a state about to change.
  await Promise.all([
    auth.restoreAuthSession.execute(),
    schema.loadSchemaSelection.execute(),
    preferences.theme.load(),
    preferences.language.load(),
    preferences.weekNumbers.load(),
    preferences.calendarVisibility.load(),
    preferences.timeFormat.load(),
    // Only the copies cached at the last read: the network is asked once a window is open.
    feeds.loadFeeds.execute(),
  ])

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  startUpdates(updates.checkForUpdate)
  void feeds.refreshFeeds.execute()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
