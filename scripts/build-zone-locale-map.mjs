/**
 * Builds PT↔EN zone aliases from zone_arc_map.json + poe2-pt-glossary.json.
 * Client.txt in PT-BR logs localized area names; matching uses canonical EN keys.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const ZONE_MAP_PATH = path.join(root, 'data', 'runtime', 'zone_arc_map.json')
const GLOSSARY_PATH = path.join(root, 'scripts', 'poe2-pt-glossary.json')
const OUT_PATH = path.join(root, 'data', 'runtime', 'zone_locale_aliases.json')

function normalize(name) {
  return name.trim().toLowerCase()
}

const zoneMap = JSON.parse(fs.readFileSync(ZONE_MAP_PATH, 'utf8'))
const glossary = JSON.parse(fs.readFileSync(GLOSSARY_PATH, 'utf8')).terms ?? {}

const canonicalByNorm = new Map()
for (const entry of zoneMap.zones) {
  canonicalByNorm.set(normalize(entry.name), entry.name)
}

/** normalized alias → canonical EN area name (Client.txt / zone_arc_map) */
const aliases = {}
/** canonical EN → PT display (in-game PT client) */
const enToPt = {}

function linkAlias(alias, canonical) {
  if (!alias || !canonical) return
  const c = canonicalByNorm.get(normalize(canonical))
  if (!c) return
  aliases[normalize(alias)] = c
}

function linkPtDisplay(en, pt) {
  if (!en || !pt) return
  const c = canonicalByNorm.get(normalize(en))
  if (!c) return
  enToPt[c] = pt
  linkAlias(pt, c)
}

for (const entry of zoneMap.zones) {
  linkAlias(entry.name, entry.name)
  const pt = glossary[entry.name]
  if (pt) linkPtDisplay(entry.name, pt)
}

for (const [en, pt] of Object.entries(glossary)) {
  if (typeof pt !== 'string') continue
  const canonical = canonicalByNorm.get(normalize(en))
  if (canonical) linkPtDisplay(canonical, pt)
}

const payload = {
  source: 'zone_arc_map + poe2-pt-glossary',
  version: 1,
  aliases,
  enToPt,
}

fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2), 'utf8')
console.log(`Wrote ${OUT_PATH} — ${Object.keys(aliases).length} aliases, ${Object.keys(enToPt).length} PT labels`)
