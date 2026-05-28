/** Stable slot ids stored in build_items.slot_label */

export type EquipmentSlotId =
  | 'weapon_main'
  | 'ring_left'
  | 'gloves'
  | 'helmet'
  | 'body_armour'
  | 'belt'
  | 'amulet'
  | 'ring_right'
  | 'boots'
  | 'weapon_off'

export interface EquipmentSlotDef {
  id: EquipmentSlotId
  label: string
  /** CSS grid-area name */
  area: string
  shortLabel: string
}

export const EQUIPMENT_SLOTS: EquipmentSlotDef[] = [
  { id: 'weapon_main', label: 'Main Hand', area: 'weapon-main', shortLabel: 'Weapon' },
  { id: 'ring_left', label: 'Ring', area: 'ring-left', shortLabel: 'Ring' },
  { id: 'gloves', label: 'Gloves', area: 'gloves', shortLabel: 'Gloves' },
  { id: 'helmet', label: 'Helmet', area: 'helmet', shortLabel: 'Helmet' },
  { id: 'body_armour', label: 'Body Armour', area: 'body', shortLabel: 'Body' },
  { id: 'belt', label: 'Belt', area: 'belt', shortLabel: 'Belt' },
  { id: 'amulet', label: 'Amulet', area: 'amulet', shortLabel: 'Amulet' },
  { id: 'ring_right', label: 'Ring', area: 'ring-right', shortLabel: 'Ring' },
  { id: 'boots', label: 'Boots', area: 'boots', shortLabel: 'Boots' },
  { id: 'weapon_off', label: 'Off Hand', area: 'weapon-off', shortLabel: 'Off-hand' },
]

const SLOT_BY_ID = Object.fromEntries(EQUIPMENT_SLOTS.map((s) => [s.id, s])) as Record<
  EquipmentSlotId,
  EquipmentSlotDef
>

/** Legacy free-text slot labels → canonical slot id */
const SLOT_ALIASES: Record<string, EquipmentSlotId> = {
  helmet: 'helmet',
  'body armour': 'body_armour',
  body: 'body_armour',
  belt: 'belt',
  amulet: 'amulet',
  gloves: 'gloves',
  boots: 'boots',
  'weapon 1': 'weapon_main',
  'main hand': 'weapon_main',
  weapon: 'weapon_main',
  'weapon 2': 'weapon_off',
  'off hand': 'weapon_off',
  offhand: 'weapon_off',
  shield: 'weapon_off',
  'ring 1': 'ring_left',
  'ring 2': 'ring_right',
  ring: 'ring_left',
}

export function normalizeSlotId(slotLabel: string): EquipmentSlotId | null {
  const key = slotLabel.trim().toLowerCase()
  if (key in SLOT_BY_ID) return key as EquipmentSlotId
  return SLOT_ALIASES[key] ?? null
}

export function getSlotDef(slotId: EquipmentSlotId): EquipmentSlotDef {
  return SLOT_BY_ID[slotId]
}

export function isWeaponSlot(slotId: EquipmentSlotId): boolean {
  return slotId === 'weapon_main' || slotId === 'weapon_off'
}

export function isOffHandSlot(slotId: EquipmentSlotId): boolean {
  return slotId === 'weapon_off'
}

export function isMainHandSlot(slotId: EquipmentSlotId): boolean {
  return slotId === 'weapon_main'
}

const SLOT_ITEM_CLASS: Partial<Record<EquipmentSlotId, string>> = {
  helmet: 'Helmet',
  body_armour: 'Body Armour',
  gloves: 'Gloves',
  boots: 'Boots',
  belt: 'Belt',
  amulet: 'Amulet',
  ring_left: 'Ring',
  ring_right: 'Ring',
}

export type SlotSearchFilter =
  | { kind: 'itemClass'; itemClass: string }
  | { kind: 'weaponMain' }
  | { kind: 'weaponOff' }

export function getSlotSearchFilter(slotId: EquipmentSlotId): SlotSearchFilter {
  if (slotId === 'weapon_main') return { kind: 'weaponMain' }
  if (slotId === 'weapon_off') return { kind: 'weaponOff' }
  const itemClass = SLOT_ITEM_CLASS[slotId]
  if (itemClass) return { kind: 'itemClass', itemClass }
  return { kind: 'itemClass', itemClass: getSlotDef(slotId).label }
}

export function getRareDisplayName(slotId: EquipmentSlotId): string {
  return `Rare ${getSlotDef(slotId).label}`
}
