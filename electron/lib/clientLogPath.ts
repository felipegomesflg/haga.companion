import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CLIENT_LOG_FILENAMES = ['Client.txt', 'LatestClient.txt']

function exists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath)
  } catch {
    return false
  }
}

function logDirs(): string[] {
  const home = os.homedir()
  const programFilesX86 = process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'
  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files'

  return [
    path.join(home, 'Documents', 'My Games', 'Path of Exile 2', 'logs'),
    path.join(programFilesX86, 'Grinding Gear Games', 'Path of Exile 2', 'logs'),
    path.join(programFiles, 'Grinding Gear Games', 'Path of Exile 2', 'logs'),
    path.join(programFilesX86, 'Steam', 'steamapps', 'common', 'Path of Exile 2', 'logs'),
    path.join(programFiles, 'Steam', 'steamapps', 'common', 'Path of Exile 2', 'logs'),
  ]
}

function candidatePaths(): string[] {
  const paths: string[] = []
  for (const dir of logDirs()) {
    for (const filename of CLIENT_LOG_FILENAMES) {
      paths.push(path.join(dir, filename))
    }
  }
  return paths
}

export function discoverClientLogPath(customPath?: string | null): string | null {
  if (customPath?.trim()) {
    const trimmed = customPath.trim()
    if (exists(trimmed)) return trimmed
  }

  for (const candidate of candidatePaths()) {
    if (exists(candidate)) return candidate
  }

  return null
}
