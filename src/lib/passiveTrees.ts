export const MAX_PASSIVE_TREES = 3

export function nextPassiveTreeSlotIndex(usedIndices: Iterable<number>): number | null {
  const used = new Set(usedIndices)
  for (let i = 0; i < MAX_PASSIVE_TREES; i++) {
    if (!used.has(i)) return i
  }
  return null
}
