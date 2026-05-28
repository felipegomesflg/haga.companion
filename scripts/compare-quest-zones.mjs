import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const zoneMap = JSON.parse(fs.readFileSync(path.join(root, 'data/runtime/zone_arc_map.json'), 'utf8'))
const campaign = JSON.parse(fs.readFileSync(path.join(root, 'data/runtime/campaign_objectives.json'), 'utf8'))

const worldAreas = zoneMap.zones.map((entry) => entry.name)
const worldAreaSet = new Set(worldAreas.map((name) => name.toLowerCase()))

const issues = []
const compound = []

for (const objective of campaign.objectives) {
  const expected = objective.expectedZoneName?.trim()
  if (!expected) {
    issues.push({ id: objective.id, problem: 'missing expectedZoneName' })
    continue
  }

  if (/\s*(?:\/|&)\s*/.test(expected)) {
    compound.push({ id: objective.id, title: objective.title, expectedZoneName: expected })
  }

  if (!worldAreaSet.has(expected.toLowerCase())) {
    issues.push({
      id: objective.id,
      title: objective.title,
      expectedZoneName: expected,
      problem: 'not in world areas (exact match)',
    })
  }
}

const referenced = new Set(
  campaign.objectives
    .map((objective) => objective.expectedZoneName?.trim().toLowerCase())
    .filter(Boolean),
)

const orphanWorldAreas = worldAreas.filter((name) => !referenced.has(name.toLowerCase())).sort()

const report = {
  summary: {
    totalObjectives: campaign.objectives.length,
    totalWorldAreas: worldAreas.length,
    invalidExpectedZones: issues.length,
    compoundExpectedZones: compound.length,
    orphanWorldAreas: orphanWorldAreas.length,
  },
  invalidExpectedZones: issues,
  compoundExpectedZones: compound,
  orphanWorldAreas,
}

console.log(JSON.stringify(report, null, 2))

if (issues.length > 0 || compound.length > 0) {
  process.exit(1)
}
