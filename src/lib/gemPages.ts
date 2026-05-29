import type { BuildGemGroup, BuildGemPage } from '../types/build'
import type { SaveGemPageInput } from '../types/ipc'

export const DRAFT_GEM_PAGE_PREFIX = 'draft-page-'

export interface DraftGemPage {
  id: string
  title: string
  sortOrder: number
  isActive: boolean
  groups: BuildGemGroup[]
}

export function createDraftGemPage(title: string, sortOrder: number, isActive: boolean): DraftGemPage {
  return {
    id: `${DRAFT_GEM_PAGE_PREFIX}${crypto.randomUUID()}`,
    title,
    sortOrder,
    isActive,
    groups: [],
  }
}

export function createEmptyDraftGemGroup(pageId: string, sortOrder: number, label: string): BuildGemGroup {
  return {
    id: `draft-group-${crypto.randomUUID()}`,
    buildId: 'draft',
    pageId,
    sortOrder,
    notes: label,
    mainGem: null,
    linkedGems: [],
    recommendedSupports: [],
  }
}

export function defaultDraftGemPages(): DraftGemPage[] {
  return [createDraftGemPage('Default', 0, true)]
}

export function getActiveDraftGemPage(pages: DraftGemPage[]): DraftGemPage {
  return pages.find((p) => p.isActive) ?? pages[0] ?? createDraftGemPage('Default', 0, true)
}

export function setActiveDraftGemPage(pages: DraftGemPage[], pageId: string): DraftGemPage[] {
  return pages.map((p) => ({ ...p, isActive: p.id === pageId }))
}

export function draftPagesToSaveInput(pages: DraftGemPage[]): SaveGemPageInput[] {
  return pages.map((page, index) => ({
    id: page.id.startsWith(DRAFT_GEM_PAGE_PREFIX) ? undefined : page.id,
    title: page.title,
    sortOrder: page.sortOrder ?? index,
    isActive: page.isActive,
    gemGroups: page.groups
      .filter((group) => group.mainGem != null)
      .map((group) => ({
        id: group.id.startsWith('draft-') ? undefined : group.id,
        pageId: page.id,
        mainGemId: group.mainGem!.gemId,
        linkedGems: group.linkedGems.map((gem) => ({ gemId: gem.gemId, notes: gem.notes })),
        notes: group.notes,
      })),
  }))
}

export function mergeDbPagesWithDraftGroups(
  pages: BuildGemPage[],
  groupsByPageId: Map<string, BuildGemGroup[]>,
): DraftGemPage[] {
  return pages.map((page) => ({
    id: page.id,
    title: page.title,
    sortOrder: page.sortOrder,
    isActive: page.isActive,
    groups: groupsByPageId.get(page.id) ?? [],
  }))
}
