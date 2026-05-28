import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, Menu, protocol } from 'electron'
import { getReferenceDb, closeReferenceDb } from './db/referenceDb'
import { getUserDb, closeUserDb } from './db/userDb'
import { registerLocalAssetProtocol } from './lib/localAssetProtocol'
import { registerIpcHandlers, setWindowRefs } from './ipc/handlers'
import { createTray, destroyTray } from './tray'
import { registerHotkeys, unregisterHotkeys } from './hotkeys'
import { showStartupSplash, closeStartupSplash } from './windows/splashWindow'
import {
  createOverlayWindow,
  showOverlayWindow,
  broadcastToWindows,
  closeAllWindows,
  syncOverlaysToGameWindow,
  hideOverlayWindow,
  initOverlayVisibilityDefaults,
  initDevTools,
} from './windows/overlayWindows'
import { startGameWindowTracker, stopGameWindowTracker } from './services/gameWindowService'
import { startClientLogTracker, stopClientLogTracker } from './services/clientLogService'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')
process.env.MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : path.join(process.env.APP_ROOT, 'dist')

let isQuitting = false
let appStartupDone = false

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'haga-local',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
])

function initDatabases(): void {
  getReferenceDb()
  getUserDb()
}

function initWindows(): void {
  createOverlayWindow('hud')
  createOverlayWindow('build-panel')
  createOverlayWindow('campaign-panel')
  createOverlayWindow('gem-toast')

  initDevTools()
}

function setupApp(): void {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.felgom.haga-overlay')
  }

  Menu.setApplicationMenu(null)

  initDatabases()
  registerIpcHandlers()
}

async function startApp(): Promise<void> {
  if (appStartupDone) {
    console.log('[splash] startup já concluído — splash ignorada')
    return
  }

  setupApp()
  console.log('[splash] aguardando splash de abertura…')
  await showStartupSplash()
  console.log('[splash] splash concluída — continuando inicialização')

  setWindowRefs({
    openSettings: () => showOverlayWindow('settings'),
    openAbout: () => showOverlayWindow('about'),
    broadcastHudUpdate: () => broadcastToWindows('haga:hudUpdated'),
    broadcastGameLocationUpdate: () =>
      broadcastToWindows('haga:gameLocationUpdated', undefined),
    broadcastActiveBuildUpdate: () => broadcastToWindows('haga:activeBuildUpdated', undefined),
    broadcastLocaleUpdate: () => broadcastToWindows('haga:localeChanged', undefined),
  })

  initOverlayVisibilityDefaults()
  initWindows()
  startGameWindowTracker(syncOverlaysToGameWindow)
  startClientLogTracker(() => broadcastToWindows('haga:gameLocationUpdated'))
  createTray(() => {
    isQuitting = true
    app.quit()
  })
  registerHotkeys()
  appStartupDone = true
}

app.whenReady().then(() => {
  registerLocalAssetProtocol()
  startApp().catch((err) => {
    console.error('Failed to start HAGA Companion:', err)
    app.quit()
  })
}).catch((err) => {
  console.error('Failed to start HAGA Companion:', err)
  app.quit()
})

app.on('window-all-closed', () => {
  // Keep running in tray on Windows
})

app.on('before-quit', () => {
  isQuitting = true
  closeStartupSplash()
  stopGameWindowTracker()
  stopClientLogTracker()
  unregisterHotkeys()
  destroyTray()
  closeAllWindows()
  closeReferenceDb()
  closeUserDb()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    initWindows()
  }
})

export { isQuitting }
