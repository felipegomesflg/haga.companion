import type { EquipmentSlotId } from './equipmentSlots'

/** Path of Building ItemSet slot name → HAGA equipment slot id */
export const POB_SLOT_TO_HAGA: Record<string, EquipmentSlotId> = {
  Helmet: 'helmet',
  'Body Armour': 'body_armour',
  Gloves: 'gloves',
  Boots: 'boots',
  Belt: 'belt',
  Amulet: 'amulet',
  'Ring 1': 'ring_left',
  'Ring 2': 'ring_right',
  'Weapon 1': 'weapon_main',
  'Weapon 2': 'weapon_off',
  'Weapon 1 Swap': 'weapon_main',
  'Weapon 2 Swap': 'weapon_off',
}

export function mapPoBSlotName(name: string): EquipmentSlotId | null {
  return POB_SLOT_TO_HAGA[name] ?? null
}
