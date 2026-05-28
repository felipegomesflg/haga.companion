import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

delete process.env.ELECTRON_RUN_AS_NODE

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')

const child = spawn(process.execPath, [viteBin], {
  stdio: 'inherit',
  env: process.env,
  cwd: root,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})
