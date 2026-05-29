import { getReferenceDb } from '../db/referenceDb'
import { getActiveBuildId, getUserDb } from '../db/userDb'
import { showGemUnlockToast } from '../windows/overlayWindows'
import { isUnknownGemId, parseUnknownGemId } from '../../src/lib/unknownGem'
import type { GemUnlockAlert } from '../../src/types/build'

function getGemRequiredLevel(craftingLevel: number | null): number {
  if (!craftingLevel || craftingLevel <= 0) return 1
  return craftingLevel
}

function buildAlert(gemId: string, craftingLevel: number | null): GemUnlockAlert | null {
  if (isUnknownGemId(gemId)) {
    const parsed = parseUnknownGemId(gemId)
    if (!parsed) return null

    return {
      gemId,
      gemName: parsed.nameSpec,
      gemType: parsed.gemType,
      color: null,
      requiredLevel: getGemRequiredLevel(craftingLevel),
    }
  }

  const ref = getReferenceDb()
  const gem = ref
    .prepare('SELECT id, name, gem_type as gemType, color, crafting_level as craftingLevel FROM gems WHERE id = ?')
    .get(gemId) as
    | { id: string; name: string; gemType: string; color: string | null; craftingLevel: number | null }
    | undefined

  if (!gem) return null

  return {
    gemId: gem.id,
    gemName: gem.name,
    gemType: gem.gemType,
    color: gem.color,
    requiredLevel: getGemRequiredLevel(gem.craftingLevel ?? craftingLevel),
  }
}

function collectBuildGemIds(buildId: string): Array<{ gemId: string; craftingLevel: number | null }> {
  const ref = getReferenceDb()
  const db = getUserDb()
  const rows = db
    .prepare(
      `
    SELECT bg.gem_id as gemId
    FROM build_gems bg
    JOIN build_gem_groups bgg ON bgg.id = bg.group_id
    JOIN build_gem_pages bgp ON bgp.id = bgg.page_id
    WHERE bgg.build_id = ? AND bgp.is_active = 1
  `,
    )
    .all(buildId) as Array<{ gemId: string }>

  return rows.map((row) => {
    const meta = ref
      .prepare('SELECT crafting_level as craftingLevel FROM gems WHERE id = ?')
      .get(row.gemId) as { craftingLevel: number | null } | undefined
    return { gemId: row.gemId, craftingLevel: meta?.craftingLevel ?? null }
  })
}

function findGemsUnlockedAtLevel(buildId: string, level: number): GemUnlockAlert[] {
  const gems = collectBuildGemIds(buildId)
  const seen = new Set<string>()
  const alerts: GemUnlockAlert[] = []

  for (const gem of gems) {
    if (seen.has(gem.gemId)) continue

    const required = getGemRequiredLevel(gem.craftingLevel)
    if (required === level) {
      seen.add(gem.gemId)
      const alert = buildAlert(gem.gemId, gem.craftingLevel)
      if (alert) alerts.push(alert)
    }
  }

  return alerts.sort((a, b) => a.gemName.localeCompare(b.gemName))
}

export function handleCharacterLevelUp(_previousLevel: number, newLevel: number): void {
  const buildId = getActiveBuildId(getUserDb())
  if (!buildId) return

  for (const alert of findGemsUnlockedAtLevel(buildId, newLevel)) {
    showGemUnlockToast(alert)
  }
}

export function debugTriggerLevelUp(targetLevel: number): GemUnlockAlert[] {
  const level = Math.floor(targetLevel)
  if (!Number.isFinite(level) || level < 1) return []

  const buildId = getActiveBuildId(getUserDb())
  if (!buildId) return []

  const alerts = findGemsUnlockedAtLevel(buildId, level)

  for (const alert of alerts) {
    showGemUnlockToast(alert, { force: true })
  }

  return alerts
}
