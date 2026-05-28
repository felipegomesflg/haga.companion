export const UNKNOWN_GEM_PREFIX = '__pob__:'

export function isUnknownGemId(gemId: string): boolean {
  return gemId.startsWith(UNKNOWN_GEM_PREFIX)
}

export function unknownGemId(nameSpec: string, gemType: string): string {
  return `${UNKNOWN_GEM_PREFIX}${gemType}:${encodeURIComponent(nameSpec.trim())}`
}

export function parseUnknownGemId(gemId: string): { nameSpec: string; gemType: string } | null {
  if (!isUnknownGemId(gemId)) return null
  const rest = gemId.slice(UNKNOWN_GEM_PREFIX.length)
  const colon = rest.indexOf(':')
  if (colon <= 0) return null
  return {
    gemType: rest.slice(0, colon),
    nameSpec: decodeURIComponent(rest.slice(colon + 1)),
  }
}

/** Infer gem type from PoB metadata gemId path when not in reference DB. */
export function inferPoBGemType(gemIdPath: string): string {
  if (/SupportGem/i.test(gemIdPath)) return 'support'
  if (/Metadata\/Items\/Gem\/SkillGem/i.test(gemIdPath)) return 'spirit'
  if (/SkillGem|MetaCast|Meta/i.test(gemIdPath)) return 'active'
  return 'support'
}
