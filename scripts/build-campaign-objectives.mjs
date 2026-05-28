import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CAMPAIGN_ARCS } from './campaign-objectives-data.mjs'
import { OBJECTIVE_EXPECTED_ZONES } from './objective-expected-zones.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '..', 'data', 'runtime', 'campaign_objectives.json')
const ZONE_MAP = path.join(__dirname, '..', 'data', 'runtime', 'zone_arc_map.json')

function loadZoneNames() {
  const data = JSON.parse(fs.readFileSync(ZONE_MAP, 'utf8'))
  return new Set(data.zones.map((entry) => entry.name))
}

function validateExpectedZones(zoneNames) {
  const errors = []
  const objectiveIds = new Set(
    CAMPAIGN_ARCS.flatMap((arc) => arc.objectives.map((objective) => objective.id)),
  )

  for (const objectiveId of objectiveIds) {
    const expected = OBJECTIVE_EXPECTED_ZONES[objectiveId]
    if (!expected?.trim()) {
      errors.push(`${objectiveId}: missing expectedZoneName`)
      continue
    }

    if (/\s*(?:\/|&)\s*/.test(expected)) {
      errors.push(`${objectiveId}: compound expectedZoneName "${expected}" — use one world area per objective`)
    }

    if (!zoneNames.has(expected.trim())) {
      errors.push(`${objectiveId}: "${expected.trim()}" not found in zone_arc_map.json`)
    }
  }

  for (const objectiveId of Object.keys(OBJECTIVE_EXPECTED_ZONES)) {
    if (!objectiveIds.has(objectiveId)) {
      errors.push(`${objectiveId}: expectedZone mapping exists but objective is missing from campaign data`)
    }
  }

  return errors
}

function buildPayload() {
  const arcs = CAMPAIGN_ARCS.map((arc) => ({
    id: arc.id,
    actNumber: arc.actNumber,
    name: arc.name,
    tabLabel: arc.tabLabel,
    description: arc.description,
    sortOrder: arc.sortOrder,
    isAvailable: arc.isAvailable !== false,
    objectiveCount: arc.objectives.length,
  }))

  const objectives = CAMPAIGN_ARCS.flatMap((arc) =>
    arc.objectives.map((obj, index) => ({
      id: obj.id,
      arcId: arc.id,
      actNumber: arc.actNumber,
      sortOrder: (index + 1) * 10,
      title: obj.title,
      description: obj.description,
      isOptional: obj.isOptional ?? false,
      objectiveType: obj.objectiveType ?? 'campaign',
      rewardTags: obj.rewardTags ?? [],
      expectedZoneName: OBJECTIVE_EXPECTED_ZONES[obj.id] ?? null,
    })),
  )

  return {
    source: 'haga-overlay-enriched',
    sources: ['poe2-leveling.com', 'mobalytics.gg', 'game8.co', 'poe2wiki.net'],
    fetchedAt: new Date().toISOString(),
    version: 2,
    arcs,
    objectives,
  }
}

const zoneNames = loadZoneNames()
const errors = validateExpectedZones(zoneNames)
if (errors.length > 0) {
  console.error('[campaign-objectives] Zone validation failed:')
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}

const payload = buildPayload()
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf-8')

console.log(
  `Wrote ${OUT} — ${payload.arcs.length} arcs, ${payload.objectives.length} objectives`,
)
