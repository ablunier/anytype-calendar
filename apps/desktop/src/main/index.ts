import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAuthIpc } from './auth/auth-ipc'
import { composeServices } from './composition'
import { registerEventsIpc } from './events/events-ipc'
import { registerSchemaIpc } from './schema/schema-ipc'
import { registerShellIpc } from './shell/shell-ipc'
import { registerThemeIpc } from './theme/theme-ipc'
import icon from '../../resources/icon.png?asset'

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
  electronApp.setAppUserModelId('me.blunier.anytype.calendar')

  const services = composeServices()
  registerAuthIpc(services)
  registerSchemaIpc(services)
  registerEventsIpc(services)
  registerThemeIpc(services)
  registerShellIpc()
  // All settle before the first window asks, so it never draws a state about to change.
  await Promise.all([
    services.restoreAuthSession.execute(),
    services.loadSchemaSelection.execute(),
    services.loadTheme.execute()
  ])

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
