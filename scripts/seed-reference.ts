/**
 * Rebuild reference.db from JSON files in data/runtime/
 * Usage: npm run seed:data
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.APP_ROOT = path.join(__dirname, '..')

const { rebuildReferenceDb, closeReferenceDb } = await import('../electron/db/referenceDb')

try {
  rebuildReferenceDb()
  console.log('reference.db regenerated successfully.')
} finally {
  closeReferenceDb()
}
