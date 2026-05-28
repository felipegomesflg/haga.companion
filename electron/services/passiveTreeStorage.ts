import fs from 'node:fs'
import path from 'node:path'
import { getAppDataDir } from '../db/paths'

const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])

export function getPassiveTreesRootDir(): string {
  const dir = path.join(getAppDataDir(), 'passive-trees')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function getBuildPassiveTreesDir(buildId: string): string {
  const dir = path.join(getPassiveTreesRootDir(), buildId)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function passiveTreeRelativePath(buildId: string, slotIndex: number, ext: string): string {
  return path.join('passive-trees', buildId, `slot-${slotIndex}${ext}`).replace(/\\/g, '/')
}

export function passiveTreeAbsolutePath(relativePath: string): string {
  return path.join(getAppDataDir(), ...relativePath.split('/'))
}

export function passiveTreeFileExists(relativePath: string | null | undefined): boolean {
  if (!relativePath) return false
  return fs.existsSync(passiveTreeAbsolutePath(relativePath))
}

export function removePassiveTreeImageFiles(buildId: string, slotIndex: number): void {
  const dir = getBuildPassiveTreesDir(buildId)
  for (const ext of ALLOWED_EXT) {
    const file = path.join(dir, `slot-${slotIndex}${ext}`)
    if (fs.existsSync(file)) {
      fs.unlinkSync(file)
    }
  }
}

export function copyPassiveTreeImage(sourcePath: string, buildId: string, slotIndex: number): string {
  const ext = path.extname(sourcePath).toLowerCase()
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error('Unsupported image format. Use PNG, JPG, WEBP, or GIF.')
  }

  removePassiveTreeImageFiles(buildId, slotIndex)

  const relativePath = passiveTreeRelativePath(buildId, slotIndex, ext)
  const destPath = passiveTreeAbsolutePath(relativePath)
  fs.mkdirSync(path.dirname(destPath), { recursive: true })
  fs.copyFileSync(sourcePath, destPath)
  return relativePath
}

export function removeBuildPassiveTreesDir(buildId: string): void {
  const dir = path.join(getPassiveTreesRootDir(), buildId)
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
