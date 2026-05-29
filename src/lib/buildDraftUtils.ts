import type { BuildGemGroup, BuildItem, BuildProfile, PassiveTreeSlot } from '../types/build'
import type { PersistBuildDraftInput, SaveEquipPageInput, SaveGemPageInput, SaveTreeSlotInput } from '../types/ipc'
import { draftEquipPagesToSaveInput, type DraftEquipPage } from './equipPages'
import { draftPagesToSaveInput, type DraftGemPage } from './gemPages'

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

export function toPersistPayload(input: {
  buildId: string | null
  name: string
  gemPages: DraftGemPage[]
  equipPages: DraftEquipPage[]
  trees: PassiveTreeSlot[]
}): PersistBuildDraftInput {
  return {
    buildId: input.buildId,
    name: input.name.trim() || 'New Build',
    gemPages: draftPagesToSaveInput(input.gemPages),
    equipPages: draftEquipPagesToSaveInput(input.equipPages),
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
  pobEquipPages: SaveEquipPageInput[],
  pobGemPages: SaveGemPageInput[],
): Promise<{ equipPages: DraftEquipPage[]; gemPages: DraftGemPage[] }> {
  console.log('[pob-import] aplicando ao draft', {
    paginasEquipPoB: pobEquipPages.length,
    itensEquipPoB: pobEquipPages.reduce((n, p) => n + p.items.length, 0),
    paginasGemPoB: pobGemPages.length,
  })

  const nextEquipPages: DraftEquipPage[] = []
  for (let pageIndex = 0; pageIndex < pobEquipPages.length; pageIndex++) {
    const pageInput = pobEquipPages[pageIndex]
    const items: BuildItem[] = []
    for (const input of pageInput.items) {
      const preview = await window.haga.previewBuildItem(input)
      console.log('[pob-import] preview item', {
        page: pageInput.title,
        slotLabel: preview.slotLabel,
        rarity: preview.rarity,
        uniqueName: preview.uniqueName,
        baseItemName: preview.baseItemName,
      })
      items.push(preview)
    }
    nextEquipPages.push({
      id: `draft-equip-page-${crypto.randomUUID()}`,
      title: pageInput.title,
      sortOrder: pageInput.sortOrder ?? pageIndex,
      isActive: pageInput.isActive,
      items,
    })
  }

  if (nextEquipPages.length > 0 && !nextEquipPages.some((p) => p.isActive)) {
    nextEquipPages[0].isActive = true
  }

  const nextGemPages: DraftGemPage[] = []
  for (let pageIndex = 0; pageIndex < pobGemPages.length; pageIndex++) {
    const pageInput = pobGemPages[pageIndex]
    const groups: BuildGemGroup[] = []
    for (let groupIndex = 0; groupIndex < pageInput.gemGroups.length; groupIndex++) {
      const group = await window.haga.previewBuildGemGroup(pageInput.gemGroups[groupIndex], groupIndex)
      console.log('[pob-import] preview gem group', {
        page: pageInput.title,
        index: groupIndex,
        mainGem: group.mainGem?.gemName ?? group.mainGem?.gemId,
        linkedCount: group.linkedGems.length,
      })
      groups.push(group)
    }
    nextGemPages.push({
      id: `draft-page-${pageIndex}-${crypto.randomUUID()}`,
      title: pageInput.title,
      sortOrder: pageInput.sortOrder ?? pageIndex,
      isActive: pageInput.isActive,
      groups,
    })
  }

  if (nextGemPages.length > 0 && !nextGemPages.some((p) => p.isActive)) {
    nextGemPages[0].isActive = true
  }

  console.log('[pob-import] draft atualizado', {
    paginasEquipNoDraft: nextEquipPages.length,
    itensTotal: nextEquipPages.reduce((n, p) => n + p.items.length, 0),
    paginasGemNoDraft: nextGemPages.length,
    gruposTotal: nextGemPages.reduce((n, p) => n + p.groups.length, 0),
  })

  return { equipPages: nextEquipPages, gemPages: nextGemPages }
}
