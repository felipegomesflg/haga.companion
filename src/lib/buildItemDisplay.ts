import type { BuildItem } from '../types/build'
import { getRareDisplayName, normalizeSlotId } from './equipmentSlots'

export function getBuildItemDisplayName(item: BuildItem): string {
  if (item.rarity === 'unique') return item.uniqueName ?? 'Unique'
  const slotId = normalizeSlotId(item.slotLabel)
  return slotId ? getRareDisplayName(slotId) : 'Rare item'
}

export function getBuildItemTooltipMods(item: BuildItem): string[] {
  return item.mods.map((m) => m.modText).filter(Boolean)
}
