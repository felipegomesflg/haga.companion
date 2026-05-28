import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const electronCli = path.join(root, 'node_modules', 'electron', 'cli.js')
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const seedScript = path.join(root, 'scripts', 'seed-reference.ts')

const result = spawnSync(process.execPath, [electronCli, tsxCli, seedScript], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
})

process.exit(result.status ?? 1)
