import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dbPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'runtime', 'reference.db')
const db = new Database(dbPath, { readonly: true })

const count = db.prepare('SELECT COUNT(*) AS c FROM campaign_objectives').get().c
const compound = db
  .prepare(
    "SELECT id, title, expected_zone_name FROM campaign_objectives WHERE expected_zone_name LIKE '%/%' OR expected_zone_name LIKE '% & %'",
  )
  .all()
const split = db
  .prepare(
    "SELECT id, title, expected_zone_name FROM campaign_objectives WHERE id IN ('act1-030', 'act1-035', 'act1-100', 'act1-105') ORDER BY id",
  )
  .all()

console.log(JSON.stringify({ count, compound, split }, null, 2))
