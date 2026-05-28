import { Menu, Tray } from 'electron'
import { getAppIconPath, loadTrayIcon } from './lib/publicAssets'
import { showOverlayWindow } from './windows/overlayWindows'

let tray: Tray | null = null

export function createTray(onExit: () => void): Tray {
  const icon = loadTrayIcon()
  tray = icon.isEmpty() ? new Tray(getAppIconPath()) : new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Settings',
      click: () => showOverlayWindow('settings'),
    },
    {
      label: 'About',
      click: () => showOverlayWindow('about'),
    },
    { type: 'separator' },
    {
      label: 'Exit',
      click: onExit,
    },
  ])

  tray.setToolTip('HAGA Companion')
  tray.setContextMenu(contextMenu)
  return tray
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
