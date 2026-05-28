import path from 'node:path'
import { BrowserWindow, screen } from 'electron'
import { loadAppIcon } from '../lib/publicAssets'

const SPLASH_DURATION_MS = 5000
const SPLASH_MAX_WAIT_MS = SPLASH_DURATION_MS + 8000
const LOG_PREFIX = '[splash]'

let splashWindow: BrowserWindow | null = null

function log(...args: unknown[]): void {
  console.log(LOG_PREFIX, ...args)
}

function getRendererUrl(): string {
  const hash = 'window=splash'
  if (process.env.VITE_DEV_SERVER_URL) {
    return `${process.env.VITE_DEV_SERVER_URL}#${hash}`
  }
  return path.join(process.env.VITE_PUBLIC ?? '.', '../dist/index.html')
}

export function closeStartupSplash(): void {
  if (splashWindow && !splashWindow.isDestroyed()) {
    log('fechando splash')
    splashWindow.destroy()
  }
  splashWindow = null
}

export function showStartupSplash(): Promise<void> {
  log('abrindo splash')
  closeStartupSplash()

  return new Promise((resolve) => {
    let finished = false
    let shownAt: number | null = null
    let closeTimer: ReturnType<typeof setTimeout> | null = null

    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    const winWidth = 420
    const winHeight = 520

    const win = new BrowserWindow({
      width: winWidth,
      height: winHeight,
      x: Math.floor((width - winWidth) / 2),
      y: Math.floor((height - winHeight) / 2),
      icon: loadAppIcon(),
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      backgroundColor: '#020617',
      webPreferences: {
        preload: path.join(process.env.MAIN_DIST ?? '.', 'preload.mjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    splashWindow = win
    win.on('closed', () => {
      if (splashWindow === win) splashWindow = null
    })

    const finish = (reason: string) => {
      if (finished) return
      finished = true
      if (closeTimer) clearTimeout(closeTimer)
      if (!win.isDestroyed()) {
        log('fechando splash', `(${reason})`)
        win.destroy()
      } else {
        log('fechando splash (janela já destruída)', `(${reason})`)
      }
      if (splashWindow === win) splashWindow = null
      resolve()
    }

    const scheduleCloseAfterMinDuration = () => {
      if (closeTimer) clearTimeout(closeTimer)
      const elapsed = shownAt ? Date.now() - shownAt : 0
      const remaining = Math.max(0, SPLASH_DURATION_MS - elapsed)
      closeTimer = setTimeout(() => finish('duração mínima'), remaining)
    }

    const showWindow = (reason: string) => {
      if (win.isDestroyed()) return
      if (win.isVisible()) return
      log('exibindo splash', `(${reason})`)
      win.show()
      shownAt = Date.now()
      scheduleCloseAfterMinDuration()
    }

    // Listeners must be registered before loadURL/loadFile — otherwise a fast/cached
    // load can emit ready-to-show before we subscribe (intermittent missing splash).
    win.once('ready-to-show', () => showWindow('ready-to-show'))

    win.webContents.once('did-finish-load', () => {
      showWindow('did-finish-load')
    })

    win.webContents.once('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error(LOG_PREFIX, 'falha ao carregar', { errorCode, errorDescription, validatedURL })
      showWindow('did-fail-load')
    })

    const url = getRendererUrl()
    log('carregando', typeof url === 'string' && url.startsWith('http') ? url.split('#')[0] : url)
    if (typeof url === 'string' && url.startsWith('http')) {
      void win.loadURL(url)
    } else {
      void win.loadFile(url, { hash: 'window=splash' })
    }

    // Cached/synchronous loads can finish before did-finish-load is queued.
    queueMicrotask(() => {
      if (win.isDestroyed() || win.isVisible()) return
      if (!win.webContents.isLoading()) {
        showWindow('load já concluído (microtask)')
      }
    })

    setTimeout(() => finish('timeout de segurança'), SPLASH_MAX_WAIT_MS)
  })
}
