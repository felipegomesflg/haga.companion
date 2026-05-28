/**
 * Runs electron-builder with output dir from prepare-electron-build.mjs
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const pointerFile = path.join(root, '.electron-builder-output.json')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))

const defaultOutput = path.join(root, 'release', pkg.version).replace(/\\/g, '/')
let outputDir = defaultOutput

if (fs.existsSync(pointerFile)) {
  try {
    const data = JSON.parse(fs.readFileSync(pointerFile, 'utf8'))
    if (data.output) outputDir = data.output.replace(/\\/g, '/')
  } catch {
    // use default
  }
}

const args = process.argv.slice(2)
const builderArgs = ['electron-builder', '--win', ...args, `-c.directories.output=${outputDir}`]

console.log(`[electron-builder] directories.output=${outputDir}`)

const result = spawnSync('npx', builderArgs, {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: process.env,
})

process.exit(result.status ?? 1)
