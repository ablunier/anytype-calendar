import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerApiVersionIpc } from './api-version/api-version-ipc'
import { registerAuthIpc } from './auth/auth-ipc'
import { composeServices } from './composition'
import { registerEventsIpc } from './events/events-ipc'
import { registerLanguageIpc } from './language/language-ipc'
import { registerSchemaIpc } from './schema/schema-ipc'
import { registerShellIpc } from './shell/shell-ipc'
import { handleSquirrelEvent, squirrelAppUserModelId } from './squirrel-startup'
import { registerThemeIpc } from './theme/theme-ipc'
import { registerTimeFormatIpc } from './time-format/time-format-ipc'
import { startAutoUpdate } from './updates/auto-update'
import { registerWeekNumbersIpc } from './week-numbers/week-numbers-ipc'
import { registerCalendarViewIpc } from './calendar-view/calendar-view-ipc'
import { registerWeekStartIpc } from './week-start/week-start-ipc'
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
  registerThemeIpc(services)
  registerLanguageIpc(services)
  registerWeekNumbersIpc(services)
  registerWeekStartIpc(services)
  registerTimeFormatIpc(services)
  registerCalendarViewIpc(services)
  registerApiVersionIpc(services)
  registerShellIpc()
  // The span a launch opens on is read from the view and week start, and the API version
  // picks what it is read through; restoring the session is what starts that first load, so
  // they have to be in place before it runs.
  await Promise.all([
    services.loadCalendarView.execute(),
    services.loadWeekStart.execute(),
    services.loadApiVersion.execute()
  ])
  // All settle before the first window asks, so it never draws a state about to change.
  await Promise.all([
    services.restoreAuthSession.execute(),
    services.loadSchemaSelection.execute(),
    services.loadTheme.execute(),
    services.loadLanguage.execute(),
    services.loadWeekNumbers.execute(),
    services.loadTimeFormat.execute()
  ])

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  startAutoUpdate()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
