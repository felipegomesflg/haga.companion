/**
 * Stops running HAGA Companion instances and frees win-unpacked for electron-builder.
 * If the folder stays locked (Explorer, antivirus, old instance), writes an alternate output path.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const version = pkg.version
const defaultOutput = path.join(root, 'release', version)
const winUnpacked = path.join(defaultOutput, 'win-unpacked')
const outputPointerFile = path.join(root, '.electron-builder-output.json')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function killWindows(processNames) {
  if (process.platform !== 'win32') return
  for (const name of processNames) {
    try {
      execSync(`taskkill /IM "${name}" /F`, { stdio: 'ignore', windowsHide: true })
      console.log(`[prepare-build] Stopped ${name}`)
    } catch {
      // not running
    }
  }
}

async function removeDirWithRetry(dir, attempts = 8) {
  if (!fs.existsSync(dir)) return true

  for (let i = 0; i < attempts; i++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 })
      return true
    } catch {
      await sleep(400)
    }
  }
  return false
}

function writeOutputPointer(outputDir) {
  fs.writeFileSync(
    outputPointerFile,
    JSON.stringify({ output: outputDir.replace(/\\/g, '/'), version }, null, 2),
    'utf8',
  )
}

killWindows(['HAGA Companion.exe', 'electron.exe'])
await sleep(800)

const winOk = await removeDirWithRetry(winUnpacked)

if (winOk) {
  writeOutputPointer(defaultOutput)
  console.log(`[prepare-build] Output: release/${version}/`)
} else {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const altOutput = path.join(root, 'release', `${version}-build-${stamp}`)
  fs.mkdirSync(altOutput, { recursive: true })
  writeOutputPointer(altOutput)
  console.warn(
    `[prepare-build] win-unpacked is locked — building to release/${path.basename(altOutput)}/ instead`,
  )
  console.warn('[prepare-build] Close HAGA Companion and Explorer on release\\, then delete the old win-unpacked folder.')
}
