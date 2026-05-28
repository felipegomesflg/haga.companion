import { globalShortcut } from 'electron'
import { getSetting, getUserDb } from './db/userDb'
import { toggleOverlayWindow, getOverlayWindow, showOverlayWindow, hideOverlayWindow } from './windows/overlayWindows'

export function registerHotkeys(): void {
  unregisterHotkeys()
  const db = getUserDb()

  const bindings: Array<[string, () => void]> = [
    [getSetting(db, 'hotkeyToggleBuildPanel'), () => toggleOverlayWindow('build-panel')],
    [getSetting(db, 'hotkeyToggleCampaignPanel'), () => toggleOverlayWindow('campaign-panel')],
    [
      getSetting(db, 'hotkeyToggleHud'),
      () => {
        const win = getOverlayWindow('hud')
        if (win?.isVisible()) hideOverlayWindow('hud')
        else showOverlayWindow('hud')
      },
    ],
    [
      getSetting(db, 'hotkeyToggleClickThrough'),
      () => {
        const hud = getOverlayWindow('hud')
        if (hud) hud.setFocusable(!hud.isFocusable())
      },
    ],
    [getSetting(db, 'hotkeyOpenSettings'), () => toggleOverlayWindow('settings')],
  ]

  for (const [accel, handler] of bindings) {
    if (!accel) continue
    try {
      globalShortcut.register(accel, handler)
    } catch {
      console.warn(`Failed to register hotkey: ${accel}`)
    }
  }
}

export function unregisterHotkeys(): void {
  globalShortcut.unregisterAll()
}
