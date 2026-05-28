import type { BudgetTier, BuildGemGroup, BuildItem, BuildProfile, PassiveTreeSlot } from '../types/build'
import type { PersistBuildDraftInput, SaveBuildItemInput, SaveGemGroupInput, SaveTreeSlotInput } from '../types/ipc'

export const NEW_BUILD_ID = '__new__'

export function nextBuildName(profiles: BuildProfile[]): string {
  const base = 'New Build'
  const names = new Set(profiles.map((p) => p.name))
  if (!names.has(base)) return base
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base} ${i}`
    if (!names.has(candidate)) return candidate
  }
  return `${base} ${Date.now()}`
}

export function itemsForBudget(items: BuildItem[], budgetTier: BudgetTier): BuildItem[] {
  return items.filter((item) => item.budgetTier === budgetTier)
}

export function upsertDraftItem(items: BuildItem[], next: BuildItem): BuildItem[] {
  const withoutSlot = items.filter(
    (item) => !(item.budgetTier === next.budgetTier && item.slotLabel === next.slotLabel),
  )
  if (next.isTwoHanded && next.slotLabel === 'weapon_main') {
    return [...withoutSlot.filter((item) => !(item.budgetTier === next.budgetTier && item.slotLabel === 'weapon_off')), next]
  }
  return [...withoutSlot, next]
}

export function toPersistPayload(input: {
  buildId: string | null
  name: string
  budgetTier: BudgetTier
  gemGroups: BuildGemGroup[]
  items: BuildItem[]
  trees: PassiveTreeSlot[]
}): PersistBuildDraftInput {
  return {
    buildId: input.buildId,
    name: input.name.trim() || 'New Build',
    budgetTier: input.budgetTier,
    gemGroups: input.gemGroups.map(
      (group): SaveGemGroupInput => ({
        id: group.id.startsWith('draft-') ? undefined : group.id,
        mainGemId: group.mainGem!.gemId,
        linkedGems: group.linkedGems.map((gem) => ({ gemId: gem.gemId, notes: gem.notes })),
        notes: group.notes,
      }),
    ),
    items: input.items.map(
      (item): SaveBuildItemInput => ({
        id: item.id.startsWith('draft-') ? undefined : item.id,
        budgetTier: item.budgetTier,
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
      }),
    ),
    trees: input.trees.map(
      (tree): SaveTreeSlotInput => ({
        slotIndex: tree.slotIndex,
        levelLabel: tree.levelLabel,
        notes: tree.notes,
      }),
    ),
  }
}

export async function applyPoBImportToDraft(
  items: BuildItem[],
  pobItems: SaveBuildItemInput[],
  pobGemGroups: SaveGemGroupInput[],
): Promise<{ items: BuildItem[]; gemGroups: BuildGemGroup[] }> {
  console.log('[pob-import] aplicando ao draft', {
    itensExistentes: items.length,
    itensPoB: pobItems.length,
    gruposGemPoB: pobGemGroups.length,
  })

  let nextItems = [...items]
  for (const input of pobItems) {
    const preview = await window.haga.previewBuildItem(input)
    console.log('[pob-import] preview item', {
      slotLabel: preview.slotLabel,
      budgetTier: preview.budgetTier,
      rarity: preview.rarity,
      uniqueName: preview.uniqueName,
      baseItemName: preview.baseItemName,
    })
    nextItems = upsertDraftItem(nextItems, preview)
  }

  const nextGemGroups: BuildGemGroup[] = []
  for (let index = 0; index < pobGemGroups.length; index++) {
    const group = await window.haga.previewBuildGemGroup(pobGemGroups[index], index)
    console.log('[pob-import] preview gem group', {
      index,
      mainGem: group.mainGem?.gemName ?? group.mainGem?.gemId,
      linkedCount: group.linkedGems.length,
    })
    nextGemGroups.push(group)
  }

  console.log('[pob-import] draft atualizado', {
    itensNoDraft: nextItems.length,
    gruposGemNoDraft: nextGemGroups.length,
  })

  return { items: nextItems, gemGroups: nextGemGroups }
}
