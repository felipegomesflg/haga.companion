import fs from 'node:fs'
import path from 'node:path'
import { nativeImage } from 'electron'

/** Brand assets live in /public (dev) or /dist after Vite build (prod). */
export function getPublicDir(): string {
  if (process.env.VITE_PUBLIC) {
    return process.env.VITE_PUBLIC
  }
  return path.join(process.env.APP_ROOT ?? '.', 'public')
}

export function getAppIconPath(): string {
  return path.resolve(getPublicDir(), 'ico.ico')
}

export function getSplashLogoPath(): string {
  return path.resolve(getPublicDir(), 'logo.png')
}

/** Loads ico.ico as a NativeImage (Windows .ico is supported natively). */
export function loadAppIcon(): Electron.NativeImage {
  const iconPath = getAppIconPath()
  if (!fs.existsSync(iconPath)) {
    console.warn(`[HAGA] App icon not found: ${iconPath}`)
    return nativeImage.createEmpty()
  }

  let icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) {
    // Some assets are PNG data saved with a .ico extension — decode from buffer instead.
    icon = nativeImage.createFromBuffer(fs.readFileSync(iconPath))
  }
  if (icon.isEmpty()) {
    const logoPath = getSplashLogoPath()
    if (fs.existsSync(logoPath)) {
      icon = nativeImage.createFromPath(logoPath)
    }
  }
  if (icon.isEmpty()) {
    console.warn(`[HAGA] Failed to decode app icon: ${iconPath}`)
  }
  return icon
}

/** 16×16 tray icon derived from ico.ico (no format conversion needed on Windows). */
export function loadTrayIcon(): Electron.NativeImage {
  const icon = loadAppIcon()
  if (icon.isEmpty()) return icon

  const { width, height } = icon.getSize()
  if (width <= 16 && height <= 16) return icon

  return icon.resize({ width: 16, height: 16, quality: 'best' })
}
