import fs from 'node:fs'
import { getJsonSeedDir } from '../db/paths'
import { getAllZoneNames, resolveAreaMatch } from './zoneArcMap'
import { getAppLocale } from '../services/localeService'
import { canonicalZoneName, localizeZoneName } from '../../src/lib/zoneCanonical'
import type { CampaignObjective } from '../../src/types/build'

interface CampaignObjectiveSeed {
  id: string
  expectedZoneName?: string | null
}

let expectedZoneByObjectiveId: Map<string, string> | null = null

function loadExpectedZoneByObjectiveId(): Map<string, string> {
  if (expectedZoneByObjectiveId) return expectedZoneByObjectiveId

  expectedZoneByObjectiveId = new Map()
  try {
    const seedPath = `${getJsonSeedDir()}/campaign_objectives.json`
    const raw = fs.readFileSync(seedPath, 'utf8')
    const data = JSON.parse(raw) as { objectives?: CampaignObjectiveSeed[] }
    for (const objective of data.objectives ?? []) {
      const zone = objective.expectedZoneName?.trim()
      if (zone) expectedZoneByObjectiveId.set(objective.id, zone)
    }
  } catch {
    // Seed file unavailable — DB/title fallbacks still apply.
  }

  return expectedZoneByObjectiveId
}

function splitExpectedZoneParts(raw: string): string[] {
  return raw
    .split(/\s*(?:\/|&)\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function resolveCanonicalZoneDisplayName(rawName: string): string {
  const match = resolveAreaMatch(rawName)
  if (match.matchType === 'unmapped' || !match.matchedZoneName) return rawName

  const normalizedMatch = match.matchedZoneName.toLowerCase()
  const found = getAllZoneNames().find((zone) => zone.toLowerCase() === normalizedMatch)
  if (found) return found

  if (match.matchType === 'exact') return rawName
  return rawName
}

function resolveSegment(rawSegment: string): string {
  const trimmed = rawSegment.trim()
  if (!trimmed) return trimmed
  return resolveCanonicalZoneDisplayName(trimmed)
}

/**
 * Expected zone for HUD highlight — EN canonical in DB; PT label when locale is pt-BR.
 */
export function resolveExpectedZoneForObjective(objective: CampaignObjective): string | null {
  const fromDb = objective.expectedZoneName?.trim()
  const fromSeed = loadExpectedZoneByObjectiveId().get(objective.id)
  const raw = fromDb || fromSeed
  if (!raw) return null

  const locale = getAppLocale()
  const parts = splitExpectedZoneParts(raw)
    .map((part) => resolveSegment(part))
    .map((en) => localizeZoneName(en, locale))

  return parts.filter(Boolean).join(' / ') || null
}

export function zonesMatchExpected(capturedArea: string | null, expectedZone: string | null): boolean {
  if (!capturedArea || !expectedZone) return false

  const capturedNorm = canonicalZoneName(capturedArea).trim().toLowerCase()
  const expectedParts = expectedZone.split(/\s*\/\s*/)

  return expectedParts.some((part) => {
    const expectedNorm = canonicalZoneName(part).trim().toLowerCase()
    if (!expectedNorm) return false
    if (capturedNorm === expectedNorm) return true
    return capturedNorm.includes(expectedNorm) || expectedNorm.includes(capturedNorm)
  })
}
