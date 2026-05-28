import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export function getAppRoot(): string {
  return process.env.APP_ROOT ?? process.cwd()
}

function isPackagedElectronApp(): boolean {
  if (!process.versions.electron) return false
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron')
    return app.isPackaged
  } catch {
    return false
  }
}

function getElectronApp() {
  // Lazy require — avoids breaking CLI seed script
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { app } = require('electron') as typeof import('electron')
  return app
}

/** SQLite databases (reference.db, user.db) */
export function getAppDataDir(): string {
  const dir = isPackagedElectronApp()
    ? path.join(getElectronApp().getPath('userData'))
    : path.join(getAppRoot(), 'data', 'runtime')

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  return dir
}

export function getReferenceDbPath(): string {
  return path.join(getAppDataDir(), 'reference.db')
}

export function getUserDbPath(): string {
  return path.join(getAppDataDir(), 'user.db')
}

/** RePoE + campaign JSON seed files (English default) */
export function getJsonSeedDir(): string {
  if (isPackagedElectronApp()) {
    return path.join(process.resourcesPath, 'seeds')
  }
  return path.join(getAppRoot(), 'data', 'runtime')
}

/** Localized game-data JSON seeds (pt-BR) */
export function getPtJsonSeedDir(): string {
  if (isPackagedElectronApp()) {
    return path.join(process.resourcesPath, 'seeds', 'pt')
  }
  return path.join(getAppRoot(), 'data', 'runtime', 'pt')
}

export function readJsonSeedFile(fileName: string, locale: 'en' | 'pt-BR' = 'en'): unknown | null {
  const baseDir = locale === 'pt-BR' ? getPtJsonSeedDir() : getJsonSeedDir()
  const filePath = path.join(baseDir, fileName)
  if (!fs.existsSync(filePath)) {
    return null
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}
