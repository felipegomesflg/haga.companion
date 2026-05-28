import { getActiveBuildId, getUserDb } from '../db/userDb'

export interface CharacterTracking {
  buildId: string
  gameCharacterName: string | null
  trackedCharacterLevel: number | null
}

function normalizeCharacterName(name: string): string {
  return name.trim().toLowerCase()
}

export function getActiveCharacterTracking(): CharacterTracking | null {
  const buildId = getActiveBuildId(getUserDb())
  if (!buildId) return null

  const row = getUserDb()
    .prepare(
      'SELECT game_character_name as gameCharacterName, tracked_character_level as trackedCharacterLevel FROM build_profiles WHERE id = ?',
    )
    .get(buildId) as
    | { gameCharacterName: string | null; trackedCharacterLevel: number | null }
    | undefined

  if (!row) return null

  return {
    buildId,
    gameCharacterName: row.gameCharacterName?.trim() || null,
    trackedCharacterLevel:
      typeof row.trackedCharacterLevel === 'number' && row.trackedCharacterLevel > 0
        ? row.trackedCharacterLevel
        : null,
  }
}

export function setGameCharacterName(buildId: string, name: string): CharacterTracking {
  const trimmed = name.trim()
  getUserDb()
    .prepare('UPDATE build_profiles SET game_character_name = ?, updated_at = ? WHERE id = ?')
    .run(trimmed || null, new Date().toISOString(), buildId)

  const tracking = getActiveCharacterTracking()
  if (!tracking || tracking.buildId !== buildId) {
    return {
      buildId,
      gameCharacterName: trimmed || null,
      trackedCharacterLevel: null,
    }
  }
  return tracking
}

export function clearTrackedCharacterLevel(buildId: string): void {
  getUserDb()
    .prepare('UPDATE build_profiles SET tracked_character_level = NULL, updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), buildId)
}

export function persistTrackedCharacterLevel(
  buildId: string,
  level: number,
  options: { gameCharacterName?: string | null } = {},
): void {
  const now = new Date().toISOString()
  const db = getUserDb()

  if (options.gameCharacterName !== undefined) {
    const trimmed = options.gameCharacterName?.trim() || null
    db.prepare(
      'UPDATE build_profiles SET tracked_character_level = ?, game_character_name = ?, updated_at = ? WHERE id = ?',
    ).run(level, trimmed, now, buildId)
    return
  }

  db.prepare('UPDATE build_profiles SET tracked_character_level = ?, updated_at = ? WHERE id = ?').run(
    level,
    now,
    buildId,
  )
}

export function characterNamesMatch(expected: string | null, candidate: string | null): boolean {
  if (!expected || !candidate) return false
  return normalizeCharacterName(expected) === normalizeCharacterName(candidate)
}

export function shouldAcceptCharacterLevel(
  tracking: CharacterTracking | null,
  parsedCharacterName: string | null,
  options: { selfWhois?: boolean; historical?: boolean } = {},
): { accept: boolean; persistName: string | null } {
  if (options.selfWhois) {
    return { accept: true, persistName: null }
  }

  const candidate = parsedCharacterName?.trim() || null
  if (!candidate) return { accept: false, persistName: null }

  if (!tracking) {
    return { accept: true, persistName: null }
  }

  if (!tracking.gameCharacterName) {
    if (options.historical) {
      return { accept: true, persistName: null }
    }
    return { accept: true, persistName: candidate }
  }

  if (characterNamesMatch(tracking.gameCharacterName, candidate)) {
    return { accept: true, persistName: null }
  }

  return { accept: false, persistName: null }
}
