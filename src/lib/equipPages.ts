import type { BuildEquipPage, BuildItem } from '../types/build'
import type { SaveEquipPageInput } from '../types/ipc'

export const DRAFT_EQUIP_PAGE_PREFIX = 'draft-equip-page-'

export interface DraftEquipPage {
  id: string
  title: string
  sortOrder: number
  isActive: boolean
  items: BuildItem[]
}

export function createDraftEquipPage(title: string, sortOrder: number, isActive: boolean): DraftEquipPage {
  return {
    id: `${DRAFT_EQUIP_PAGE_PREFIX}${crypto.randomUUID()}`,
    title,
    sortOrder,
    isActive,
    items: [],
  }
}

export function defaultDraftEquipPages(): DraftEquipPage[] {
  return [createDraftEquipPage('Default', 0, true)]
}

export function getActiveDraftEquipPage(pages: DraftEquipPage[]): DraftEquipPage {
  return pages.find((p) => p.isActive) ?? pages[0] ?? createDraftEquipPage('Default', 0, true)
}

export function setActiveDraftEquipPage(pages: DraftEquipPage[], pageId: string): DraftEquipPage[] {
  return pages.map((p) => ({ ...p, isActive: p.id === pageId }))
}

export function draftEquipPagesToSaveInput(pages: DraftEquipPage[]): SaveEquipPageInput[] {
  return pages.map((page, index) => ({
    id: page.id.startsWith(DRAFT_EQUIP_PAGE_PREFIX) ? undefined : page.id,
    title: page.title,
    sortOrder: page.sortOrder ?? index,
    isActive: page.isActive,
    items: page.items.map((item) => ({
      id: item.id.startsWith('draft-') ? undefined : item.id,
      pageId: page.id,
      rarity: item.rarity,
      uniqueId: item.uniqueId,
      baseItemId: item.baseItemId,
      slotLabel: item.slotLabel,
      priority: item.priority,
      notes: item.notes,
      mods: item.mods.map((mod) => ({
        modId: mod.modId,
        generationType: mod.generationType,
        slotIndex: mod.slotIndex,
      })),
    })),
  }))
}

export function mergeDbEquipPagesWithDraftItems(
  pages: BuildEquipPage[],
  itemsByPageId: Map<string, BuildItem[]>,
): DraftEquipPage[] {
  return pages.map((page) => ({
    id: page.id,
    title: page.title,
    sortOrder: page.sortOrder,
    isActive: page.isActive,
    items: itemsByPageId.get(page.id) ?? [],
  }))
}

export function upsertDraftItemOnPage(items: BuildItem[], next: BuildItem): BuildItem[] {
  const withoutSlot = items.filter((item) => item.slotLabel !== next.slotLabel)
  if (next.isTwoHanded && next.slotLabel === 'weapon_main') {
    return [...withoutSlot.filter((item) => item.slotLabel !== 'weapon_off'), next]
  }
  return [...withoutSlot, next]
}
