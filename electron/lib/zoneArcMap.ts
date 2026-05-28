import fs from 'node:fs'
import { getJsonSeedDir } from '../db/paths'

interface ZoneArcEntry {
  name: string
  arcId: string
}

interface ZoneArcMapFile {
  zones: ZoneArcEntry[]
}

interface ZoneLocaleAliasesFile {
  aliases?: Record<string, string>
}

let zoneByNormalizedName: Map<string, string> | null = null

function normalizeZoneName(name: string): string {
  return name.trim().toLowerCase()
}

function loadLocaleAliases(): Record<string, string> {
  try {
    const aliasPath = `${getJsonSeedDir()}/zone_locale_aliases.json`
    const raw = fs.readFileSync(aliasPath, 'utf8')
    const data = JSON.parse(raw) as ZoneLocaleAliasesFile
    return data.aliases ?? {}
  } catch {
    return {}
  }
}

function loadZoneMap(): Map<string, string> {
  if (zoneByNormalizedName) return zoneByNormalizedName

  const mapPath = `${getJsonSeedDir()}/zone_arc_map.json`
  const raw = fs.readFileSync(mapPath, 'utf8')
  const data = JSON.parse(raw) as ZoneArcMapFile

  zoneByNormalizedName = new Map(
    data.zones.map((entry) => [normalizeZoneName(entry.name), entry.arcId]),
  )

  const localeAliases = loadLocaleAliases()
  for (const [aliasNorm, canonicalEn] of Object.entries(localeAliases)) {
    const arcId = zoneByNormalizedName.get(normalizeZoneName(canonicalEn))
    if (arcId) zoneByNormalizedName.set(aliasNorm, arcId)
  }

  return zoneByNormalizedName
}

export type AreaMatchType = 'exact' | 'partial' | 'unmapped'

export interface AreaMatchResult {
  arcId: string | null
  matchType: AreaMatchType
  matchedZoneName: string | null
}

export function resolveAreaMatch(areaName: string): AreaMatchResult {
  const map = loadZoneMap()
  const normalized = normalizeZoneName(areaName)

  const exact = map.get(normalized)
  if (exact) {
    return { arcId: exact, matchType: 'exact', matchedZoneName: areaName }
  }

  for (const [zoneName, arcId] of map.entries()) {
    if (normalized.includes(zoneName) || zoneName.includes(normalized)) {
      return { arcId, matchType: 'partial', matchedZoneName: zoneName }
    }
  }

  return { arcId: null, matchType: 'unmapped', matchedZoneName: null }
}

export function resolveArcIdForArea(areaName: string): string | null {
  return resolveAreaMatch(areaName).arcId
}

export function getZonesForArc(arcId: string): string[] {
  const mapPath = `${getJsonSeedDir()}/zone_arc_map.json`
  const raw = fs.readFileSync(mapPath, 'utf8')
  const data = JSON.parse(raw) as ZoneArcMapFile

  return data.zones.filter((entry) => entry.arcId === arcId).map((entry) => entry.name)
}

export function getAllZoneNames(): string[] {
  const mapPath = `${getJsonSeedDir()}/zone_arc_map.json`
  const raw = fs.readFileSync(mapPath, 'utf8')
  const data = JSON.parse(raw) as ZoneArcMapFile

  return data.zones.map((entry) => entry.name)
}
