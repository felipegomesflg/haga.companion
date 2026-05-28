import { BrowserWindow, screen } from 'electron'
import path from 'node:path'
import { loadAppIcon } from '../lib/publicAssets'
import type { GameWindowBounds } from '../lib/poeGameWindow'
import type { GemUnlockAlert } from '../../src/types/build'
import { getPoeGameWindowState, isPoeGameForeground, isPoeGameRunning } from '../services/gameWindowService'
import { getSetting, getUserDb, setSetting } from '../db/userDb'

const DESKTOP_WINDOW_KINDS = new Set<OverlayWindowKind>(['settings', 'about'])
export const GAME_OVERLAY_KINDS = new Set<OverlayWindowKind>([
  'hud',
  'build-panel',
  'campaign-panel',
  'dev-tools-rail',
  'dev-location-modal',
  'dev-level-box',
  'gem-toast',
])

const DEV_OVERLAY_KINDS = new Set<OverlayWindowKind>([
  'dev-tools-rail',
  'dev-location-modal',
  'dev-level-box',
])

/** User explicitly opened a panel (hotkey). Only hotkey / X may change this. */
const userWantsVisible = new Map<OverlayWindowKind, boolean>()

const GEM_TOAST_WIDTH = 340
const GEM_TOAST_HEIGHT = 108
const DEV_TOOLS_RAIL_WIDTH = 36
const DEV_TOOLS_RAIL_HEIGHT = 88
const DEV_MODAL_WIDTH = 520
const DEV_MODAL_HEIGHT = 560
const DEV_LEVEL_BOX_WIDTH = 320
const DEV_LEVEL_BOX_HEIGHT = 520

export function isDevRuntime(): boolean {
  return Boolean(process.env.VITE_DEV_SERVER_URL)
}

let gemUnlockQueue: GemUnlockAlert[] = []
let gemUnlockPlaying = false
let gemUnlockForceNext = false

const GEM_TOAST_DISPLAY_MS = 5200

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function presentGemUnlockToast(alert: GemUnlockAlert, options: { force?: boolean }): void {
  const { bounds } = getPoeGameWindowState()

  userWantsVisible.set('gem-toast', true)
  const win = getOverlayWindow('gem-toast') ?? createOverlayWindow('gem-toast')
  if (bounds) {
    win.setBounds(gemToastBounds(bounds))
  } else if (options.force) {
    const { workArea } = screen.getPrimaryDisplay()
    win.setBounds({
      width: GEM_TOAST_WIDTH,
      height: GEM_TOAST_HEIGHT,
      x: workArea.x + workArea.width - GEM_TOAST_WIDTH - 24,
      y: workArea.y + Math.floor((workArea.height - GEM_TOAST_HEIGHT) / 2),
    })
  }

  win.show()
  win.webContents.send('haga:gemUnlockAlert', alert)
}

async function drainGemUnlockQueue(): Promise<void> {
  gemUnlockPlaying = true
  const force = gemUnlockForceNext
  gemUnlockForceNext = false

  while (gemUnlockQueue.length > 0) {
    const alert = gemUnlockQueue.shift()!
    presentGemUnlockToast(alert, { force })
    await sleep(GEM_TOAST_DISPLAY_MS)
  }

  hideOverlayWindow('gem-toast')
  userWantsVisible.set('gem-toast', false)
  gemUnlockPlaying = false
}

export function showGemUnlockToast(alert: GemUnlockAlert, options: { force?: boolean } = {}): void {
  if (!options.force && !isPoeGameForeground()) return

  if (options.force) gemUnlockForceNext = true
  gemUnlockQueue.push(alert)

  if (!gemUnlockPlaying) {
    void drainGemUnlockQueue()
  }
}

export type OverlayWindowKind =
  | 'hud'
  | 'build-panel'
  | 'campaign-panel'
  | 'dev-tools-rail'
  | 'dev-location-modal'
  | 'dev-level-box'
  | 'gem-toast'
  | 'settings'
  | 'about'

const windows = new Map<OverlayWindowKind, BrowserWindow>()

const BUILD_PANEL_WIDTH = 420
const BUILD_PANEL_EAR_WIDTH = 28
const BUILD_PANEL_EAR_HEIGHT = 64

export const HUD_HEADER_HEIGHT = 52
export const HUD_EXPANDED_BODY_HEIGHT = HUD_HEADER_HEIGHT * 4
export const HUD_FOOTER_HEIGHT = 36
export const HUD_TOP_OFFSET = 8

export type HudLayoutMode = 'compact' | 'expanded' | 'maximized'

let hudLayoutMode: HudLayoutMode = 'compact'
let hudShowFooter = false

export type BuildPanelDockSide = 'left' | 'right'

function loadBuildPanelDockSide(): BuildPanelDockSide {
  return getSetting(getUserDb(), 'buildPanelDockSide') === 'left' ? 'left' : 'right'
}

let buildPanelDockSide: BuildPanelDockSide = 'right'

let buildPanelCollapsed = true

export function getBuildPanelDockSide(): BuildPanelDockSide {
  return buildPanelDockSide
}

export function isBuildPanelCollapsed(): boolean {
  return buildPanelCollapsed
}

let buildPanelMaximized = false

export function isBuildPanelMaximized(): boolean {
  return buildPanelMaximized
}

function getRendererUrl(kind: OverlayWindowKind): string {
  const hash = `window=${kind}`
  if (process.env.VITE_DEV_SERVER_URL) {
    return `${process.env.VITE_DEV_SERVER_URL}#${hash}`
  }
  return path.join(process.env.VITE_PUBLIC ?? '.', '../dist/index.html')
}

export function initOverlayVisibilityDefaults(): void {
  if (getSetting(getUserDb(), 'overlayHudAlwaysVisible') === 'true') {
    userWantsVisible.set('hud', true)
  }
  buildPanelDockSide = loadBuildPanelDockSide()
  // Permanent build tab on the right edge (collapsed) for first-time discovery.
  userWantsVisible.set('build-panel', true)
}

function buildPanelX(game: GameWindowBounds, width: number): number {
  return buildPanelDockSide === 'right' ? game.x + game.width - width : game.x
}

function buildPanelNormalExpandedBounds(game: GameWindowBounds): Electron.Rectangle {
  const height = Math.max(280, Math.floor(game.height * 0.5))
  return {
    width: BUILD_PANEL_WIDTH,
    height,
    x: buildPanelX(game, BUILD_PANEL_WIDTH),
    y: game.y + Math.floor((game.height - height) / 2),
  }
}

function buildPanelMaximizedBounds(game: GameWindowBounds): Electron.Rectangle {
  const height = Math.max(280, Math.floor(game.height * 0.98))
  return {
    width: BUILD_PANEL_WIDTH,
    height,
    x: buildPanelX(game, BUILD_PANEL_WIDTH),
    y: game.y + Math.floor(game.height * 0.01),
  }
}

function buildPanelExpandedBounds(game: GameWindowBounds): Electron.Rectangle {
  return buildPanelMaximized ? buildPanelMaximizedBounds(game) : buildPanelNormalExpandedBounds(game)
}

function gemToastBounds(game: GameWindowBounds): Electron.Rectangle {
  return {
    width: GEM_TOAST_WIDTH,
    height: GEM_TOAST_HEIGHT,
    x: game.x + game.width - GEM_TOAST_WIDTH - 24,
    y: game.y + Math.floor((game.height - GEM_TOAST_HEIGHT) / 2),
  }
}

function devToolsRailBounds(game: GameWindowBounds): Electron.Rectangle {
  const buildPanelY = game.y + Math.floor((game.height - BUILD_PANEL_EAR_HEIGHT) / 2)
  return {
    width: DEV_TOOLS_RAIL_WIDTH,
    height: DEV_TOOLS_RAIL_HEIGHT,
    x: game.x + 8,
    y: Math.max(game.y + HUD_TOP_OFFSET + 8, buildPanelY - DEV_TOOLS_RAIL_HEIGHT - 12),
  }
}

function devLevelBoxBounds(game: GameWindowBounds): Electron.Rectangle {
  const rail = devToolsRailBounds(game)
  const width = Math.min(DEV_LEVEL_BOX_WIDTH, game.width - rail.width - 24)
  const height = Math.min(DEV_LEVEL_BOX_HEIGHT, game.height - 24)
  const x = rail.x + rail.width + 6
  let y = rail.y
  if (y + height > game.y + game.height - 8) {
    y = Math.max(game.y + 8, game.y + game.height - height - 8)
  }
  return { width, height, x, y }
}

function devModalBounds(game: GameWindowBounds): Electron.Rectangle {
  const width = Math.min(DEV_MODAL_WIDTH, game.width - 48)
  const height = Math.min(DEV_MODAL_HEIGHT, game.height - 48)
  return {
    width,
    height,
    x: game.x + Math.floor((game.width - width) / 2),
    y: game.y + Math.floor((game.height - height) / 2),
  }
}

function buildPanelCollapsedBounds(game: GameWindowBounds): Electron.Rectangle {
  return {
    width: BUILD_PANEL_EAR_WIDTH,
    height: BUILD_PANEL_EAR_HEIGHT,
    x: buildPanelX(game, BUILD_PANEL_EAR_WIDTH),
    y: game.y + Math.floor((game.height - BUILD_PANEL_EAR_HEIGHT) / 2),
  }
}

function buildPanelBounds(game: GameWindowBounds): Electron.Rectangle {
  return buildPanelCollapsed
    ? buildPanelCollapsedBounds(game)
    : buildPanelExpandedBounds(game)
}

function notifyBuildPanelCollapsed(win: BrowserWindow): void {
  if (!win.isDestroyed()) {
    win.webContents.send('haga:buildPanelCollapsed', buildPanelCollapsed)
  }
}

function notifyBuildPanelMaximized(win: BrowserWindow): void {
  if (!win.isDestroyed()) {
    win.webContents.send('haga:buildPanelMaximized', buildPanelMaximized)
  }
}

function notifyBuildPanelDockSide(win: BrowserWindow): void {
  if (!win.isDestroyed()) {
    win.webContents.send('haga:buildPanelDockSide', buildPanelDockSide)
  }
}

function applyBuildPanelBounds(): void {
  const { bounds } = getPoeGameWindowState()
  if (!bounds) return

  const win = getOverlayWindow('build-panel')
  if (!win || win.isDestroyed()) return

  win.setBounds(buildPanelBounds(bounds))
  notifyBuildPanelCollapsed(win)
  notifyBuildPanelMaximized(win)
  notifyBuildPanelDockSide(win)
}

function hudBounds(game: GameWindowBounds): Electron.Rectangle {
  const compactWidth = Math.min(720, game.width - 40)
  const x = game.x + Math.floor((game.width - compactWidth) / 2)
  const y = game.y + HUD_TOP_OFFSET

  if (hudLayoutMode === 'maximized') {
    const width = Math.min(900, Math.max(compactWidth, Math.floor(game.width * 0.5)))
    const height = Math.max(280, Math.floor(game.height * 0.5))
    return {
      x: game.x + Math.floor((game.width - width) / 2),
      y,
      width,
      height,
    }
  }

  if (hudLayoutMode === 'expanded') {
    return {
      x,
      y,
      width: compactWidth,
      height: HUD_HEADER_HEIGHT + HUD_EXPANDED_BODY_HEIGHT + (hudShowFooter ? HUD_FOOTER_HEIGHT : 0),
    }
  }

  const footerHeight = hudShowFooter ? HUD_FOOTER_HEIGHT : 0

  return {
    x,
    y,
    width: compactWidth,
    height: HUD_HEADER_HEIGHT + footerHeight,
  }
}

export function getHudLayoutMode(): HudLayoutMode {
  return hudLayoutMode
}

export function setHudLayoutMode(mode: HudLayoutMode, showFooter = false): void {
  hudLayoutMode = mode
  hudShowFooter = showFooter
  applyHudBounds()
}

function applyHudBounds(): void {
  const { bounds } = getPoeGameWindowState()
  if (!bounds) return

  const win = getOverlayWindow('hud')
  if (!win || win.isDestroyed()) return

  win.setBounds(hudBounds(bounds))
  win.webContents.send('haga:hudLayoutMode', hudLayoutMode)
}

function positionForKind(kind: OverlayWindowKind, game: GameWindowBounds): Electron.Rectangle {
  switch (kind) {
    case 'hud':
      return hudBounds(game)
    case 'build-panel':
      return buildPanelBounds(game)
    case 'campaign-panel': {
      const width = 640
      const height = 520
      return {
        x: game.x + Math.floor((game.width - width) / 2),
        y: game.y + Math.floor((game.height - height) / 2),
        width,
        height,
      }
    }
    case 'dev-tools-rail':
      return devToolsRailBounds(game)
    case 'dev-location-modal':
      return devModalBounds(game)
    case 'dev-level-box':
      return devLevelBoxBounds(game)
    case 'gem-toast':
      return gemToastBounds(game)
    default:
      return { x: 0, y: 0, width: 0, height: 0 }
  }
}

export function repositionOverlayWindow(kind: OverlayWindowKind, game: GameWindowBounds): void {
  if (!GAME_OVERLAY_KINDS.has(kind)) return
  if (kind === 'build-panel') {
    applyBuildPanelBounds()
    return
  }
  if (kind === 'hud') {
    applyHudBounds()
    return
  }
  const win = getOverlayWindow(kind)
  if (!win || win.isDestroyed()) return
  win.setBounds(positionForKind(kind, game))
}

/** Follow PoE2 window; hide when another app has focus (not PoE2 and not a HAGA game overlay). */
export function syncOverlaysToGameWindow(state: {
  bounds: GameWindowBounds | null
  isForeground: boolean
}): void {
  if (!isGameOverlayContextActive(state)) {
    for (const kind of GAME_OVERLAY_KINDS) {
      getOverlayWindow(kind)?.hide()
    }
    return
  }

  const game = state.bounds!
  for (const kind of GAME_OVERLAY_KINDS) {
    if (DEV_OVERLAY_KINDS.has(kind) && !isDevRuntime()) continue
    if (!userWantsVisible.get(kind)) continue

    const win = getOverlayWindow(kind) ?? createOverlayWindow(kind)
    repositionOverlayWindow(kind, game)
    if (!win.isVisible()) win.show()
  }
}

export function toggleBuildPanelMaximized(): void {
  if (!isGameOverlayContextActive() || buildPanelCollapsed) return

  buildPanelMaximized = !buildPanelMaximized
  applyBuildPanelBounds()

  const win = getOverlayWindow('build-panel')
  win?.focus()
}

export function toggleBuildPanelDockSide(): void {
  if (!isGameOverlayContextActive()) return

  buildPanelDockSide = buildPanelDockSide === 'right' ? 'left' : 'right'
  setSetting(getUserDb(), 'buildPanelDockSide', buildPanelDockSide)
  applyBuildPanelBounds()

  const win = getOverlayWindow('build-panel')
  win?.focus()
}

export function collapseBuildPanel(): void {
  if (!isGameOverlayContextActive()) return

  userWantsVisible.set('build-panel', true)
  buildPanelCollapsed = true

  const win = getOverlayWindow('build-panel') ?? createOverlayWindow('build-panel')
  applyBuildPanelBounds()
  win.show()
}

export function expandBuildPanel(): void {
  if (!isGameOverlayContextActive()) return

  userWantsVisible.set('build-panel', true)
  buildPanelCollapsed = false

  const win = getOverlayWindow('build-panel') ?? createOverlayWindow('build-panel')
  applyBuildPanelBounds()
  win.show()
  win.focus()
}

export function toggleBuildPanel(): void {
  if (!isPoeGameRunning()) return

  if (!userWantsVisible.get('build-panel')) {
    collapseBuildPanel()
    return
  }

  if (buildPanelCollapsed) expandBuildPanel()
  else collapseBuildPanel()
}

function overlayOptions(kind: OverlayWindowKind): Electron.BrowserWindowConstructorOptions {
  const primary = screen.getPrimaryDisplay().workAreaSize
  const base: Electron.BrowserWindowConstructorOptions = {
    icon: loadAppIcon(),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(process.env.MAIN_DIST ?? '.', 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  }

  switch (kind) {
    case 'hud':
      return {
        ...base,
        width: Math.min(720, primary.width - 40),
        height: HUD_HEADER_HEIGHT,
        x: Math.floor((primary.width - Math.min(720, primary.width - 40)) / 2),
        y: 8,
        focusable: true,
      }
    case 'build-panel': {
      const panel = buildPanelExpandedBounds({
        x: 0,
        y: 0,
        width: primary.width,
        height: primary.height,
      })
      return {
        ...base,
        width: panel.width,
        height: panel.height,
        x: panel.x,
        y: panel.y,
        resizable: false,
        focusable: true,
      }
    }
    case 'campaign-panel':
      return {
        ...base,
        width: 640,
        height: 520,
        x: Math.floor((primary.width - 640) / 2),
        y: Math.floor((primary.height - 520) / 2),
        focusable: true,
      }
    case 'settings':
      return {
        ...base,
        width: 580,
        height: 720,
        minWidth: 520,
        minHeight: 480,
        x: Math.floor((primary.width - 580) / 2),
        y: Math.floor((primary.height - 720) / 2),
        transparent: false,
        frame: true,
        autoHideMenuBar: true,
        alwaysOnTop: false,
        skipTaskbar: false,
        resizable: true,
        focusable: true,
        title: 'HAGA Settings',
      }
    case 'about':
      return {
        ...base,
        width: 440,
        height: 360,
        minWidth: 360,
        minHeight: 280,
        x: Math.floor((primary.width - 440) / 2),
        y: Math.floor((primary.height - 360) / 2),
        transparent: false,
        frame: true,
        autoHideMenuBar: true,
        alwaysOnTop: false,
        skipTaskbar: false,
        resizable: false,
        focusable: true,
        title: 'About HAGA Companion',
      }
    case 'dev-tools-rail':
      return {
        ...base,
        width: DEV_TOOLS_RAIL_WIDTH,
        height: DEV_TOOLS_RAIL_HEIGHT,
        x: 8,
        y: 120,
        focusable: true,
      }
    case 'dev-location-modal':
      return {
        ...base,
        width: DEV_MODAL_WIDTH,
        height: DEV_MODAL_HEIGHT,
        x: Math.floor((primary.width - DEV_MODAL_WIDTH) / 2),
        y: Math.floor((primary.height - DEV_MODAL_HEIGHT) / 2),
        focusable: true,
      }
    case 'dev-level-box':
      return {
        ...base,
        width: DEV_LEVEL_BOX_WIDTH,
        height: DEV_LEVEL_BOX_HEIGHT,
        x: 52,
        y: 120,
        focusable: true,
      }
    case 'gem-toast':
      return {
        ...base,
        width: GEM_TOAST_WIDTH,
        height: GEM_TOAST_HEIGHT,
        x: primary.width - GEM_TOAST_WIDTH - 24,
        y: Math.floor((primary.height - GEM_TOAST_HEIGHT) / 2),
        focusable: false,
      }
  }
}

export function createOverlayWindow(kind: OverlayWindowKind): BrowserWindow {
  const existing = windows.get(kind)
  if (existing && !existing.isDestroyed()) return existing

  const win = new BrowserWindow(overlayOptions(kind))

  if (DESKTOP_WINDOW_KINDS.has(kind)) {
    win.setMenuBarVisibility(false)
    win.removeMenu()
    const icon = loadAppIcon()
    if (!icon.isEmpty()) win.setIcon(icon)
  } else {
    win.setAlwaysOnTop(true, 'screen-saver')
  }

  const url = getRendererUrl(kind)
  if (typeof url === 'string' && url.startsWith('http')) {
    win.loadURL(url)
  } else {
    win.loadFile(url, { hash: `window=${kind}` })
  }

  win.on('closed', () => windows.delete(kind))

  if (GAME_OVERLAY_KINDS.has(kind)) {
    win.on('focus', () => {
      syncOverlaysToGameWindow(getPoeGameWindowState())
    })
  }

  win.once('ready-to-show', () => {
    if (DESKTOP_WINDOW_KINDS.has(kind)) {
      win.show()
      return
    }

    if (!userWantsVisible.get(kind)) return

    const { bounds } = getPoeGameWindowState()
    if (bounds && isGameOverlayContextActive()) {
      repositionOverlayWindow(kind, bounds)
      if (kind === 'build-panel') {
        notifyBuildPanelCollapsed(win)
        notifyBuildPanelMaximized(win)
        notifyBuildPanelDockSide(win)
      }
      if (kind === 'hud') {
        win.webContents.send('haga:hudLayoutMode', hudLayoutMode)
      }
      win.show()
    }
  })
  windows.set(kind, win)
  return win
}

export function getOverlayWindow(kind: OverlayWindowKind): BrowserWindow | undefined {
  const win = windows.get(kind)
  if (win && !win.isDestroyed()) return win
  return undefined
}

/** PoE2 is running and either the game or a HAGA game overlay has focus (clicks on companion must not hide UI). */
function isGameOverlayContextActive(
  state: { bounds: GameWindowBounds | null; isForeground: boolean } = getPoeGameWindowState(),
): boolean {
  if (!state.bounds) return false
  if (state.isForeground) return true

  const focused = BrowserWindow.getFocusedWindow()
  if (!focused) return false

  for (const kind of GAME_OVERLAY_KINDS) {
    const win = getOverlayWindow(kind)
    if (win && !win.isDestroyed() && focused.id === win.id) return true
  }

  return false
}

export function toggleOverlayWindow(kind: OverlayWindowKind): void {
  if (kind === 'build-panel') {
    toggleBuildPanel()
    return
  }

  if (GAME_OVERLAY_KINDS.has(kind) && !isPoeGameRunning()) return

  const win = getOverlayWindow(kind) ?? createOverlayWindow(kind)
  if (win.isVisible()) hideOverlayWindow(kind)
  else showOverlayWindow(kind)
}

export function showOverlayWindow(kind: OverlayWindowKind): void {
  if (kind === 'build-panel') {
    expandBuildPanel()
    return
  }

  if (GAME_OVERLAY_KINDS.has(kind)) {
    if (!isGameOverlayContextActive()) return
    userWantsVisible.set(kind, true)
    const { bounds } = getPoeGameWindowState()
    const win = getOverlayWindow(kind) ?? createOverlayWindow(kind)
    if (bounds) repositionOverlayWindow(kind, bounds)
    win.show()
    if (kind !== 'hud') win.focus()
    return
  }

  const win = getOverlayWindow(kind) ?? createOverlayWindow(kind)
  win.show()
}

export function hideOverlayWindow(kind: OverlayWindowKind): void {
  if (kind === 'build-panel') {
    collapseBuildPanel()
    return
  }

  if (GAME_OVERLAY_KINDS.has(kind)) {
    userWantsVisible.set(kind, false)
  }
  getOverlayWindow(kind)?.hide()
}

export function openDevLocationModal(): void {
  if (!isDevRuntime() || !isPoeGameRunning()) return
  showOverlayWindow('dev-location-modal')
}

export function openDevLevelBox(): void {
  if (!isDevRuntime() || !isPoeGameRunning()) return
  showOverlayWindow('dev-level-box')
}

export function initDevTools(): void {
  if (!isDevRuntime()) return
  userWantsVisible.set('dev-tools-rail', true)
  createOverlayWindow('dev-tools-rail')
}

/** Release focus from companion overlays so PoE2 can receive keyboard input again. */
export function blurGameOverlayWindows(sender?: BrowserWindow): void {
  if (sender && !sender.isDestroyed()) {
    sender.blur()
  }
  for (const kind of GAME_OVERLAY_KINDS) {
    const win = getOverlayWindow(kind)
    if (win && !win.isDestroyed()) win.blur()
  }
}

export function broadcastToWindows(channel: string, payload?: unknown): void {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

export function closeAllWindows(): void {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.close()
  }
  windows.clear()
}
