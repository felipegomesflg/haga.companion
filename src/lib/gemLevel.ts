export function getGemRequiredLevel(craftingLevel: number | null | undefined): number {
  if (!craftingLevel || craftingLevel <= 0) return 1
  return craftingLevel
}

export function isGemAtCurrentLevel(
  craftingLevel: number | null | undefined,
  characterLevel: number | null | undefined,
): boolean {
  return characterLevel != null && getGemRequiredLevel(craftingLevel) === characterLevel
}

export function isGemLocked(
  characterLevel: number | null | undefined,
  craftingLevel: number | null | undefined,
): boolean {
  if (characterLevel == null) return false
  return characterLevel < getGemRequiredLevel(craftingLevel)
}
