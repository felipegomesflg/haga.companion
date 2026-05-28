export const MAX_LINKED_GEMS = 5

export const MAIN_GEM_TYPES = ['active', 'spirit'] as const

export type MainGemType = (typeof MAIN_GEM_TYPES)[number]

export function isMainGemType(gemType: string): gemType is MainGemType {
  return gemType === 'active' || gemType === 'spirit'
}

/** Linked gem types allowed for a given main gem type. */
export function allowedLinkedGemTypes(mainGemType: string): string[] {
  if (mainGemType === 'spirit') return ['active', 'support']
  if (mainGemType === 'active') return ['support']
  return []
}

export function validateGemGroup(mainGemType: string, linkedGemTypes: string[]): string | null {
  if (!isMainGemType(mainGemType)) {
    return 'Main gem must be active or spirit.'
  }
  if (linkedGemTypes.length > MAX_LINKED_GEMS) {
    return `At most ${MAX_LINKED_GEMS} linked gems per group.`
  }
  const allowed = allowedLinkedGemTypes(mainGemType)
  for (const t of linkedGemTypes) {
    if (!allowed.includes(t)) {
      return mainGemType === 'active'
        ? 'Active gems can only link support gems.'
        : 'Invalid linked gem type for this group.'
    }
  }
  return null
}
