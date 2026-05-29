import { v4 as uuidv4 } from 'uuid'
import { getSlotSearchFilter, normalizeSlotId, type EquipmentSlotId } from '../../src/lib/equipmentSlots'
import { buildRePoEArtUrl } from '../../src/lib/repoeAssets'
import { validateGemGroup } from '../../src/lib/gemGroups'
import { MAX_PASSIVE_TREES } from '../../src/lib/passiveTrees'
import { toLocalAssetUrl } from '../lib/localAssetProtocol'
import { getReferenceDb } from '../db/referenceDb'
import { getUserDb } from '../db/userDb'
import { getReferenceTableNames } from '../lib/refTables'
import { getAppLocale } from './localeService'
import {
  copyPassiveTreeImage,
  passiveTreeFileExists,
  removePassiveTreeImageFiles,
} from './passiveTreeStorage'
import { isUnknownGemId, parseUnknownGemId } from '../../src/lib/unknownGem'
import type {
  BudgetTier,
  BuildEquipPage,
  BuildGemGroup,
  BuildGemLink,
  BuildGemPage,
  BuildItem,
  BuildProfile,
  PassiveTreeSlot,
  RecommendedSupportGem,
} from '../../src/types/build'
import type {
  PersistBuildDraftInput,
  SaveBuildItemInput,
  SaveEquipPageInput,
  SaveGemGroupInput,
  SaveGemPageInput,
  SaveTreeSlotInput,
} from '../../src/types/ipc'
import { importCompletedObjectiveIds } from './objectiveService'

function refTables() {
  return getReferenceTableNames(getAppLocale())
}

type BuildRow = {
  id: string
  name: string
  class_name: string | null
  notes: string | null
  active_budget_tier: BudgetTier
  is_active: number
  game_character_name: string | null
  tracked_character_level: number | null
  created_at: string
  updated_at: string
}

function mapProfile(row: BuildRow): BuildProfile {
  return {
    id: row.id,
    name: row.name,
    className: row.class_name,
    notes: row.notes,
    activeBudgetTier: row.active_budget_tier,
    isActive: row.is_active === 1,
    gameCharacterName: row.game_character_name?.trim() || null,
    trackedCharacterLevel:
      typeof row.tracked_character_level === 'number' && row.tracked_character_level > 0
        ? row.tracked_character_level
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function getBuildProfiles(): BuildProfile[] {
  const rows = getUserDb()
    .prepare('SELECT * FROM build_profiles ORDER BY name')
    .all() as BuildRow[]
  return rows.map(mapProfile)
}

export function getActiveBuild(): BuildProfile | null {
  const row = getUserDb()
    .prepare('SELECT * FROM build_profiles WHERE is_active = 1 LIMIT 1')
    .get() as BuildRow | undefined
  return row ? mapProfile(row) : null
}

export function setActiveBuild(buildId: string): void {
  const db = getUserDb()
  const tx = db.transaction(() => {
    db.prepare('UPDATE build_profiles SET is_active = 0').run()
    db.prepare('UPDATE build_profiles SET is_active = 1 WHERE id = ?').run(buildId)
  })
  tx()
}

export function createBuild(name: string, className?: string): BuildProfile {
  const db = getUserDb()
  const id = uuidv4()
  const now = new Date().toISOString()
  db.prepare('UPDATE build_profiles SET is_active = 0').run()
  db.prepare(`
    INSERT INTO build_profiles (id, name, class_name, notes, active_budget_tier, is_active, created_at, updated_at)
    VALUES (?, ?, ?, '', 'early', 1, ?, ?)
  `).run(id, name, className ?? null, now, now)

  ensureDefaultGemPage(id)
  ensureDefaultEquipPage(id)

  const row = db.prepare('SELECT * FROM build_profiles WHERE id = ?').get(id) as BuildRow
  return mapProfile(row)
}

export function renameBuild(buildId: string, name: string): BuildProfile {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Build name is required.')

  const db = getUserDb()
  const existing = db.prepare('SELECT id FROM build_profiles WHERE id = ?').get(buildId)
  if (!existing) throw new Error('Build not found.')

  const now = new Date().toISOString()
  db.prepare('UPDATE build_profiles SET name = ?, updated_at = ? WHERE id = ?').run(trimmed, now, buildId)

  const row = db.prepare('SELECT * FROM build_profiles WHERE id = ?').get(buildId) as BuildRow
  return mapProfile(row)
}

export function previewBuildItem(input: SaveBuildItemInput, buildId = 'draft'): BuildItem {
  const ref = getReferenceDb()
  const id = input.id ?? uuidv4()

  const unique = input.uniqueId
    ? (ref.prepare(`SELECT name, icon_dds_file as iconDdsFile FROM ${refTables().uniqueItems} WHERE id = ?`).get(input.uniqueId) as
        | { name: string; iconDdsFile: string | null }
        | undefined)
    : undefined
  const base = input.baseItemId
    ? (ref.prepare(`SELECT name, icon_dds_file as iconDdsFile FROM ${refTables().baseItems} WHERE id = ?`).get(input.baseItemId) as
        | { name: string; iconDdsFile: string | null }
        | undefined)
    : undefined

  const meta = resolveItemMeta(ref, {
    unique_id: input.uniqueId ?? null,
    base_item_id: input.baseItemId ?? null,
  })
  const iconDdsFile = unique?.iconDdsFile ?? base?.iconDdsFile ?? null

  return {
    id,
    buildId,
    budgetTier: 'early',
    pageId: input.pageId ?? 'draft-page',
    rarity: input.rarity,
    uniqueId: input.uniqueId ?? null,
    uniqueName: unique?.name ?? null,
    baseItemId: input.baseItemId ?? null,
    baseItemName: base?.name ?? null,
    slotLabel: input.slotLabel,
    priority: input.priority,
    notes: input.notes ?? null,
    itemClass: meta.itemClass,
    isTwoHanded: meta.isTwoHanded,
    iconDdsFile,
    iconArtUrl: buildRePoEArtUrl(iconDdsFile),
    mods: input.mods.map((mod) => {
      const row = ref.prepare(`SELECT text FROM ${refTables().mods} WHERE id = ?`).get(mod.modId) as { text: string } | undefined
      return {
        id: uuidv4(),
        modId: mod.modId,
        modText: row?.text ?? mod.modId,
        generationType: mod.generationType,
        slotIndex: mod.slotIndex,
      }
    }),
  }
}

export function previewBuildGemGroup(input: SaveGemGroupInput, sortOrder = 0, buildId = 'draft'): BuildGemGroup {
  const ref = getReferenceDb()
  const groupId = input.id ?? uuidv4()
  const gemRows = [
    { id: uuidv4(), gem_id: input.mainGemId, link_index: 0, notes: null as string | null },
    ...input.linkedGems.map((gem, index) => ({
      id: uuidv4(),
      gem_id: gem.gemId,
      link_index: index + 1,
      notes: gem.notes ?? null,
    })),
  ]

  return mapGemGroup(
    ref,
    {
      id: groupId,
      build_id: buildId,
      page_id: input.pageId ?? 'draft-page',
      sort_order: sortOrder,
      notes: input.notes ?? null,
    },
    gemRows,
  )
}

type GemPageRow = {
  id: string
  build_id: string
  title: string
  sort_order: number
  is_active: number
}

function mapGemPage(row: GemPageRow): BuildGemPage {
  return {
    id: row.id,
    buildId: row.build_id,
    title: row.title,
    sortOrder: row.sort_order,
    isActive: row.is_active === 1,
  }
}

export function ensureDefaultGemPage(buildId: string): string {
  const db = getUserDb()
  const existing = db
    .prepare('SELECT id FROM build_gem_pages WHERE build_id = ? ORDER BY sort_order LIMIT 1')
    .get(buildId) as { id: string } | undefined
  if (existing) return existing.id

  const pageId = uuidv4()
  db.prepare(
    'INSERT INTO build_gem_pages (id, build_id, title, sort_order, is_active) VALUES (?, ?, ?, 0, 1)',
  ).run(pageId, buildId, 'Default')
  return pageId
}

export function getBuildGemPages(buildId: string): BuildGemPage[] {
  ensureDefaultGemPage(buildId)
  const db = getUserDb()
  const rows = db
    .prepare('SELECT * FROM build_gem_pages WHERE build_id = ? ORDER BY sort_order, title')
    .all(buildId) as GemPageRow[]
  return rows.map(mapGemPage)
}

export function getActiveGemPageId(buildId: string): string {
  const db = getUserDb()
  const active = db
    .prepare('SELECT id FROM build_gem_pages WHERE build_id = ? AND is_active = 1 LIMIT 1')
    .get(buildId) as { id: string } | undefined
  if (active) return active.id
  return ensureDefaultGemPage(buildId)
}

export function setActiveGemPage(buildId: string, pageId: string): BuildGemPage[] {
  const db = getUserDb()
  const page = db
    .prepare('SELECT id FROM build_gem_pages WHERE id = ? AND build_id = ?')
    .get(pageId, buildId) as { id: string } | undefined
  if (!page) throw new Error('Gem page not found.')

  db.prepare('UPDATE build_gem_pages SET is_active = 0 WHERE build_id = ?').run(buildId)
  db.prepare('UPDATE build_gem_pages SET is_active = 1 WHERE id = ?').run(pageId)
  return getBuildGemPages(buildId)
}

export function createBuildGemPage(buildId: string, title: string): BuildGemPage {
  const db = getUserDb()
  const trimmed = title.trim() || 'New page'
  const sortOrder = (
    db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM build_gem_pages WHERE build_id = ?').get(buildId) as {
      next: number
    }
  ).next
  const pageId = uuidv4()
  db.prepare('UPDATE build_gem_pages SET is_active = 0 WHERE build_id = ?').run(buildId)
  db.prepare(
    'INSERT INTO build_gem_pages (id, build_id, title, sort_order, is_active) VALUES (?, ?, ?, ?, 1)',
  ).run(pageId, buildId, trimmed, sortOrder)
  return mapGemPage(
    db.prepare('SELECT * FROM build_gem_pages WHERE id = ?').get(pageId) as GemPageRow,
  )
}

export function renameBuildGemPage(pageId: string, title: string): BuildGemPage {
  const trimmed = title.trim()
  if (!trimmed) throw new Error('Page title is required.')
  const db = getUserDb()
  db.prepare('UPDATE build_gem_pages SET title = ? WHERE id = ?').run(trimmed, pageId)
  const row = db.prepare('SELECT * FROM build_gem_pages WHERE id = ?').get(pageId) as GemPageRow | undefined
  if (!row) throw new Error('Gem page not found.')
  return mapGemPage(row)
}

export function deleteBuildGemPage(pageId: string): void {
  const db = getUserDb()
  const row = db.prepare('SELECT build_id FROM build_gem_pages WHERE id = ?').get(pageId) as
    | { build_id: string }
    | undefined
  if (!row) throw new Error('Gem page not found.')

  const count = (
    db.prepare('SELECT COUNT(*) as c FROM build_gem_pages WHERE build_id = ?').get(row.build_id) as { c: number }
  ).c
  if (count <= 1) throw new Error('Cannot delete the only gem page.')

  const wasActive = (
    db.prepare('SELECT is_active FROM build_gem_pages WHERE id = ?').get(pageId) as { is_active: number }
  ).is_active

  db.prepare('DELETE FROM build_gem_pages WHERE id = ?').run(pageId)

  if (wasActive === 1) {
    const next = db
      .prepare('SELECT id FROM build_gem_pages WHERE build_id = ? ORDER BY sort_order LIMIT 1')
      .get(row.build_id) as { id: string } | undefined
    if (next) {
      db.prepare('UPDATE build_gem_pages SET is_active = 1 WHERE id = ?').run(next.id)
    }
  }
}

export function clearBuildGemPages(buildId: string): void {
  getUserDb().prepare('DELETE FROM build_gem_pages WHERE build_id = ?').run(buildId)
}

export function saveBuildGemPagesPoB(buildId: string, pages: SaveGemPageInput[]): void {
  const db = getUserDb()
  db.prepare('DELETE FROM build_gem_pages WHERE build_id = ?').run(buildId)

  let activeAssigned = false
  pages.forEach((page, pageIndex) => {
    const pageId = uuidv4()
    const isActive = page.isActive && !activeAssigned
    if (isActive) activeAssigned = true
    db.prepare(
      'INSERT INTO build_gem_pages (id, build_id, title, sort_order, is_active) VALUES (?, ?, ?, ?, ?)',
    ).run(pageId, buildId, page.title.trim() || `Set ${pageIndex + 1}`, page.sortOrder ?? pageIndex, isActive ? 1 : 0)

    page.gemGroups.forEach((group, sortOrder) => {
      saveBuildGemGroupPoB(buildId, pageId, {
        sortOrder,
        mainGemId: group.mainGemId,
        linkedGemIds: group.linkedGems.map((g) => g.gemId).slice(0, 5),
        notes: group.notes ?? null,
      })
    })
  })

  if (!activeAssigned && pages.length > 0) {
    const first = db
      .prepare('SELECT id FROM build_gem_pages WHERE build_id = ? ORDER BY sort_order LIMIT 1')
      .get(buildId) as { id: string }
    db.prepare('UPDATE build_gem_pages SET is_active = 1 WHERE id = ?').run(first.id)
  }
}

type EquipPageRow = {
  id: string
  build_id: string
  title: string
  sort_order: number
  is_active: number
}

function mapEquipPage(row: EquipPageRow): BuildEquipPage {
  return {
    id: row.id,
    buildId: row.build_id,
    title: row.title,
    sortOrder: row.sort_order,
    isActive: row.is_active === 1,
  }
}

export function ensureDefaultEquipPage(buildId: string): string {
  const db = getUserDb()
  const existing = db
    .prepare('SELECT id FROM build_equip_pages WHERE build_id = ? ORDER BY sort_order LIMIT 1')
    .get(buildId) as { id: string } | undefined
  if (existing) return existing.id

  const pageId = uuidv4()
  db.prepare(
    'INSERT INTO build_equip_pages (id, build_id, title, sort_order, is_active) VALUES (?, ?, ?, 0, 1)',
  ).run(pageId, buildId, 'Default')
  return pageId
}

export function getBuildEquipPages(buildId: string): BuildEquipPage[] {
  ensureDefaultEquipPage(buildId)
  const db = getUserDb()
  const rows = db
    .prepare('SELECT * FROM build_equip_pages WHERE build_id = ? ORDER BY sort_order, title')
    .all(buildId) as EquipPageRow[]
  return rows.map(mapEquipPage)
}

export function getActiveEquipPageId(buildId: string): string {
  const db = getUserDb()
  const active = db
    .prepare('SELECT id FROM build_equip_pages WHERE build_id = ? AND is_active = 1 LIMIT 1')
    .get(buildId) as { id: string } | undefined
  if (active) return active.id
  return ensureDefaultEquipPage(buildId)
}

export function setActiveEquipPage(buildId: string, pageId: string): BuildEquipPage[] {
  const db = getUserDb()
  const page = db
    .prepare('SELECT id FROM build_equip_pages WHERE id = ? AND build_id = ?')
    .get(pageId, buildId) as { id: string } | undefined
  if (!page) throw new Error('Equip page not found.')

  db.prepare('UPDATE build_equip_pages SET is_active = 0 WHERE build_id = ?').run(buildId)
  db.prepare('UPDATE build_equip_pages SET is_active = 1 WHERE id = ?').run(pageId)
  return getBuildEquipPages(buildId)
}

export function createBuildEquipPage(buildId: string, title: string): BuildEquipPage {
  const db = getUserDb()
  const trimmed = title.trim() || 'New page'
  const sortOrder = (
    db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM build_equip_pages WHERE build_id = ?').get(
      buildId,
    ) as { next: number }
  ).next
  const pageId = uuidv4()
  db.prepare('UPDATE build_equip_pages SET is_active = 0 WHERE build_id = ?').run(buildId)
  db.prepare(
    'INSERT INTO build_equip_pages (id, build_id, title, sort_order, is_active) VALUES (?, ?, ?, ?, 1)',
  ).run(pageId, buildId, trimmed, sortOrder)
  return mapEquipPage(db.prepare('SELECT * FROM build_equip_pages WHERE id = ?').get(pageId) as EquipPageRow)
}

export function renameBuildEquipPage(pageId: string, title: string): BuildEquipPage {
  const trimmed = title.trim()
  if (!trimmed) throw new Error('Page title is required.')
  const db = getUserDb()
  db.prepare('UPDATE build_equip_pages SET title = ? WHERE id = ?').run(trimmed, pageId)
  const row = db.prepare('SELECT * FROM build_equip_pages WHERE id = ?').get(pageId) as EquipPageRow | undefined
  if (!row) throw new Error('Equip page not found.')
  return mapEquipPage(row)
}

export function deleteBuildEquipPage(pageId: string): void {
  const db = getUserDb()
  const row = db.prepare('SELECT build_id FROM build_equip_pages WHERE id = ?').get(pageId) as
    | { build_id: string }
    | undefined
  if (!row) throw new Error('Equip page not found.')

  const count = (
    db.prepare('SELECT COUNT(*) as c FROM build_equip_pages WHERE build_id = ?').get(row.build_id) as { c: number }
  ).c
  if (count <= 1) throw new Error('Cannot delete the only equip page.')

  const wasActive = (
    db.prepare('SELECT is_active FROM build_equip_pages WHERE id = ?').get(pageId) as { is_active: number }
  ).is_active

  db.prepare('DELETE FROM build_equip_pages WHERE id = ?').run(pageId)

  if (wasActive === 1) {
    const next = db
      .prepare('SELECT id FROM build_equip_pages WHERE build_id = ? ORDER BY sort_order LIMIT 1')
      .get(row.build_id) as { id: string } | undefined
    if (next) db.prepare('UPDATE build_equip_pages SET is_active = 1 WHERE id = ?').run(next.id)
  }
}

export function clearBuildEquipPages(buildId: string): void {
  getUserDb().prepare('DELETE FROM build_equip_pages WHERE build_id = ?').run(buildId)
}

export function saveBuildEquipPagesPoB(buildId: string, pages: SaveEquipPageInput[]): void {
  const db = getUserDb()
  db.prepare('DELETE FROM build_equip_pages WHERE build_id = ?').run(buildId)
  db.prepare('DELETE FROM build_items WHERE build_id = ?').run(buildId)

  let activeAssigned = false
  pages.forEach((page, pageIndex) => {
    const pageId = uuidv4()
    const isActive = page.isActive && !activeAssigned
    if (isActive) activeAssigned = true
    db.prepare(
      'INSERT INTO build_equip_pages (id, build_id, title, sort_order, is_active) VALUES (?, ?, ?, ?, ?)',
    ).run(pageId, buildId, page.title.trim() || `Set ${pageIndex + 1}`, page.sortOrder ?? pageIndex, isActive ? 1 : 0)

    for (const item of page.items) {
      saveBuildItem(buildId, { ...item, pageId })
    }
  })

  if (!activeAssigned && pages.length > 0) {
    const first = db
      .prepare('SELECT id FROM build_equip_pages WHERE build_id = ? ORDER BY sort_order LIMIT 1')
      .get(buildId) as { id: string }
    db.prepare('UPDATE build_equip_pages SET is_active = 1 WHERE id = ?').run(first.id)
  }
}

export function persistBuildDraft(input: PersistBuildDraftInput): BuildProfile {
  const db = getUserDb()
  const now = new Date().toISOString()
  const trimmedName = input.name.trim() || 'New Build'
  let buildId = input.buildId

  if (!buildId) {
    buildId = createBuild(trimmedName).id
  } else {
    const row = db.prepare('SELECT name FROM build_profiles WHERE id = ?').get(buildId) as { name: string } | undefined
    if (!row) throw new Error('Build not found.')
    if (row.name !== trimmedName) renameBuild(buildId, trimmedName)
    setActiveBuild(buildId)
  }

  db.prepare('UPDATE build_profiles SET updated_at = ? WHERE id = ?').run(now, buildId)

  if (input.gemPages.length > 0) {
    clearBuildGemPages(buildId)
    saveBuildGemPagesPoB(buildId!, input.gemPages)
  } else {
    clearBuildGemPages(buildId)
    ensureDefaultGemPage(buildId!)
  }

  if (input.equipPages.length > 0) {
    clearBuildEquipPages(buildId)
    saveBuildEquipPagesPoB(buildId!, input.equipPages)
  } else {
    clearBuildEquipPages(buildId)
    ensureDefaultEquipPage(buildId!)
  }

  const draftSlotIndexes = new Set(input.trees.map((tree) => tree.slotIndex))
  for (const tree of getPassiveTrees(buildId)) {
    if (!draftSlotIndexes.has(tree.slotIndex)) {
      deletePassiveTreeSlot(buildId, tree.slotIndex)
    }
  }
  for (const tree of input.trees) {
    savePassiveTreeSlot(buildId, tree)
  }

  const row = db.prepare('SELECT * FROM build_profiles WHERE id = ?').get(buildId) as BuildRow
  return mapProfile(row)
}

function isTwoHandedWeapon(itemClass: string, tagsJson?: string | null): boolean {
  if (/two hand/i.test(itemClass)) return true
  if (!tagsJson) return false
  try {
    const tags = JSON.parse(tagsJson) as string[]
    return tags.some((t) => t === 'two_hand_weapon' || t === 'twohand')
  } catch {
    return false
  }
}

function resolveItemMeta(
  ref: ReturnType<typeof getReferenceDb>,
  row: { unique_id: string | null; base_item_id: string | null },
): { itemClass: string | null; isTwoHanded: boolean } {
  if (row.unique_id) {
    const unique = ref.prepare(`SELECT item_class FROM ${refTables().uniqueItems} WHERE id = ?`).get(row.unique_id) as
      | { item_class: string }
      | undefined
    const itemClass = unique?.item_class ?? null
    return { itemClass, isTwoHanded: itemClass ? isTwoHandedWeapon(itemClass) : false }
  }
  if (row.base_item_id) {
    const base = ref.prepare(`SELECT item_class, tags FROM ${refTables().baseItems} WHERE id = ?`).get(row.base_item_id) as
      | { item_class: string; tags: string }
      | undefined
    const itemClass = base?.item_class ?? null
    return {
      itemClass,
      isTwoHanded: itemClass ? isTwoHandedWeapon(itemClass, base?.tags) : false,
    }
  }
  return { itemClass: null, isTwoHanded: false }
}

function resolveGemTagLabels(ref: ReturnType<typeof getReferenceDb>, gemId: string): string[] {
  if (isUnknownGemId(gemId)) return []

  const row = ref.prepare(`SELECT tags FROM ${refTables().gems} WHERE id = ?`).get(gemId) as { tags: string | null } | undefined
  if (!row?.tags) return []

  let tagIds: string[]
  try {
    tagIds = JSON.parse(row.tags) as string[]
  } catch {
    return []
  }

  const labelStmt = ref.prepare(`SELECT display_label FROM ${refTables().gemTags} WHERE id = ?`)
  return tagIds.map((id) => {
    const tag = labelStmt.get(id) as { display_label: string | null } | undefined
    return tag?.display_label?.trim() || id.replace(/_/g, ' ')
  })
}

function resolveRecommendedSupports(
  ref: ReturnType<typeof getReferenceDb>,
  gemId: string,
): RecommendedSupportGem[] {
  if (isUnknownGemId(gemId)) return []

  const row = ref.prepare(`SELECT recommended_supports FROM ${refTables().gems} WHERE id = ?`).get(gemId) as
    | { recommended_supports: string | null }
    | undefined
  if (!row?.recommended_supports) return []

  let ids: string[]
  try {
    ids = JSON.parse(row.recommended_supports) as string[]
  } catch {
    return []
  }

  return ids.map((id) => {
    const gem = ref.prepare(`SELECT name, gem_type, color FROM ${refTables().gems} WHERE id = ?`).get(id) as
      | { name: string; gem_type: string; color: string | null }
      | undefined
    return {
      gemId: id,
      gemName: gem?.name ?? id,
      gemType: gem?.gem_type ?? 'support',
      color: gem?.color ?? null,
    }
  })
}

function resolveGemLink(
  ref: ReturnType<typeof getReferenceDb>,
  row: { id: string; gem_id: string; link_index: number; notes: string | null },
): BuildGemLink {
  if (isUnknownGemId(row.gem_id)) {
    const parsed = parseUnknownGemId(row.gem_id)
    return {
      id: row.id,
      gemId: row.gem_id,
      gemName: parsed?.nameSpec ?? row.gem_id,
      gemType: parsed?.gemType ?? 'support',
      color: null,
      craftingLevel: null,
      tags: [],
      isUnknown: true,
      linkIndex: row.link_index,
      notes: row.notes,
    }
  }

  const gem = ref.prepare(`SELECT name, gem_type, color, crafting_level FROM ${refTables().gems} WHERE id = ?`).get(row.gem_id) as
    | { name: string; gem_type: string; color: string | null; crafting_level: number | null }
    | undefined
  return {
    id: row.id,
    gemId: row.gem_id,
    gemName: gem?.name ?? row.gem_id,
    gemType: gem?.gem_type ?? 'active',
    color: gem?.color ?? null,
    craftingLevel: gem?.crafting_level ?? null,
    tags: resolveGemTagLabels(ref, row.gem_id),
    isUnknown: false,
    linkIndex: row.link_index,
    notes: row.notes,
  }
}

function mapGemGroup(
  ref: ReturnType<typeof getReferenceDb>,
  group: { id: string; build_id: string; page_id: string; sort_order: number; notes: string | null },
  gemRows: Array<{ id: string; gem_id: string; link_index: number; notes: string | null }>,
): BuildGemGroup {
  const links = gemRows.map((row) => resolveGemLink(ref, row))
  const mainGem = links.find((l) => l.linkIndex === 0) ?? null
  const linkedGems = links.filter((l) => l.linkIndex > 0).sort((a, b) => a.linkIndex - b.linkIndex)
  const recommendedSupports =
    mainGem && (mainGem.gemType === 'active' || mainGem.gemType === 'spirit')
      ? resolveRecommendedSupports(ref, mainGem.gemId)
      : []
  return {
    id: group.id,
    buildId: group.build_id,
    pageId: group.page_id,
    sortOrder: group.sort_order,
    notes: group.notes,
    mainGem,
    linkedGems,
    recommendedSupports,
  }
}

export function getBuildGemGroups(buildId: string, pageId?: string): BuildGemGroup[] {
  const ref = getReferenceDb()
  const db = getUserDb()
  const resolvedPageId = pageId ?? getActiveGemPageId(buildId)
  const groups = db
    .prepare('SELECT * FROM build_gem_groups WHERE build_id = ? AND page_id = ? ORDER BY sort_order')
    .all(buildId, resolvedPageId) as Array<{
    id: string
    build_id: string
    page_id: string
    sort_order: number
    notes: string | null
  }>

  return groups.map((group) => {
    const gemRows = db
      .prepare('SELECT * FROM build_gems WHERE group_id = ? ORDER BY link_index')
      .all(group.id) as Array<{ id: string; gem_id: string; link_index: number; notes: string | null }>
    return mapGemGroup(ref, group, gemRows)
  })
}

export function saveBuildGemGroup(buildId: string, input: SaveGemGroupInput): BuildGemGroup {
  const db = getUserDb()
  const ref = getReferenceDb()

  const mainMeta = ref.prepare(`SELECT gem_type FROM ${refTables().gems} WHERE id = ?`).get(input.mainGemId) as
    | { gem_type: string }
    | undefined
  if (!mainMeta) throw new Error('Main gem not found in reference data.')

  const linkedTypes: string[] = []
  for (const linked of input.linkedGems.slice(0, 5)) {
    const meta = ref.prepare(`SELECT gem_type FROM ${refTables().gems} WHERE id = ?`).get(linked.gemId) as
      | { gem_type: string }
      | undefined
    if (!meta) throw new Error('Linked gem not found in reference data.')
    linkedTypes.push(meta.gem_type)
  }

  const validationError = validateGemGroup(mainMeta.gem_type, linkedTypes)
  if (validationError) throw new Error(validationError)

  const existingGroup = input.id
    ? (db.prepare('SELECT id FROM build_gem_groups WHERE id = ? AND build_id = ?').get(input.id, buildId) as
        | { id: string }
        | undefined)
    : undefined

  const groupId = existingGroup?.id ?? uuidv4()
  const pageId = input.pageId ?? getActiveGemPageId(buildId)

  const sortOrder = existingGroup
    ? ((db.prepare('SELECT sort_order FROM build_gem_groups WHERE id = ?').get(groupId) as { sort_order: number }).sort_order)
    : ((
        db
          .prepare(
            'SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM build_gem_groups WHERE build_id = ? AND page_id = ?',
          )
          .get(buildId, pageId) as { next: number }
      ).next)

  if (existingGroup) {
    db.prepare('UPDATE build_gem_groups SET notes = ? WHERE id = ?').run(input.notes ?? null, groupId)
    db.prepare('DELETE FROM build_gems WHERE group_id = ?').run(groupId)
  } else {
    db.prepare('INSERT INTO build_gem_groups (id, build_id, page_id, sort_order, notes) VALUES (?, ?, ?, ?, ?)').run(
      groupId,
      buildId,
      pageId,
      sortOrder,
      input.notes ?? null,
    )
  }

  db.prepare('INSERT INTO build_gems (id, group_id, gem_id, link_index, notes) VALUES (?, ?, ?, 0, ?)').run(
    uuidv4(),
    groupId,
    input.mainGemId,
    null,
  )

  input.linkedGems.slice(0, 5).forEach((linked, index) => {
    db.prepare('INSERT INTO build_gems (id, group_id, gem_id, link_index, notes) VALUES (?, ?, ?, ?, ?)').run(
      uuidv4(),
      groupId,
      linked.gemId,
      index + 1,
      linked.notes ?? null,
    )
  })

  return getBuildGemGroups(buildId, pageId).find((g) => g.id === groupId)!
}

export function deleteBuildGemGroup(groupId: string): void {
  getUserDb().prepare('DELETE FROM build_gem_groups WHERE id = ?').run(groupId)
}

/** @deprecated Prefer clearBuildGemPages */
export function clearBuildGemGroups(buildId: string): void {
  clearBuildGemPages(buildId)
}

export function saveBuildGemGroupPoB(
  buildId: string,
  pageId: string,
  input: { sortOrder: number; mainGemId: string; linkedGemIds: string[]; notes?: string | null },
): void {
  const db = getUserDb()
  const groupId = uuidv4()
  db.prepare('INSERT INTO build_gem_groups (id, build_id, page_id, sort_order, notes) VALUES (?, ?, ?, ?, ?)').run(
    groupId,
    buildId,
    pageId,
    input.sortOrder,
    input.notes ?? null,
  )
  db.prepare('INSERT INTO build_gems (id, group_id, gem_id, link_index, notes) VALUES (?, ?, ?, 0, ?)').run(
    uuidv4(),
    groupId,
    input.mainGemId,
    null,
  )
  input.linkedGemIds.slice(0, 5).forEach((gemId, index) => {
    db.prepare('INSERT INTO build_gems (id, group_id, gem_id, link_index, notes) VALUES (?, ?, ?, ?, ?)').run(
      uuidv4(),
      groupId,
      gemId,
      index + 1,
      null,
    )
  })
}

export function getBuildItems(buildId: string, pageId?: string): BuildItem[] {
  const ref = getReferenceDb()
  const user = getUserDb()
  const resolvedPageId = pageId ?? getActiveEquipPageId(buildId)

  const rows = user
    .prepare('SELECT * FROM build_items WHERE build_id = ? AND page_id = ? ORDER BY priority, slot_label')
    .all(buildId, resolvedPageId) as Array<{
    id: string
    build_id: string
    page_id: string | null
    budget_tier: BudgetTier
    rarity: 'unique' | 'rare'
    unique_id: string | null
    base_item_id: string | null
    slot_label: string
    priority: number
    notes: string | null
  }>

  return rows.map((row) => {
    const unique = row.unique_id
      ? (ref.prepare(`SELECT name, icon_dds_file as iconDdsFile FROM ${refTables().uniqueItems} WHERE id = ?`).get(row.unique_id) as
          | { name: string; iconDdsFile: string | null }
          | undefined)
      : undefined
    const base = row.base_item_id
      ? (ref.prepare(`SELECT name, icon_dds_file as iconDdsFile FROM ${refTables().baseItems} WHERE id = ?`).get(row.base_item_id) as
          | { name: string; iconDdsFile: string | null }
          | undefined)
      : undefined

    const modRows = user
      .prepare('SELECT * FROM build_item_mods WHERE build_item_id = ? ORDER BY generation_type, slot_index')
      .all(row.id) as Array<{
      id: string
      mod_id: string
      generation_type: 'prefix' | 'suffix'
      slot_index: number
    }>

    const meta = resolveItemMeta(ref, row)
    const iconDdsFile = unique?.iconDdsFile ?? base?.iconDdsFile ?? null

    return {
      id: row.id,
      buildId: row.build_id,
      pageId: row.page_id ?? resolvedPageId,
      budgetTier: row.budget_tier,
      rarity: row.rarity,
      uniqueId: row.unique_id,
      uniqueName: unique?.name ?? null,
      baseItemId: row.base_item_id,
      baseItemName: base?.name ?? null,
      slotLabel: row.slot_label,
      priority: row.priority,
      notes: row.notes,
      itemClass: meta.itemClass,
      isTwoHanded: meta.isTwoHanded,
      iconDdsFile,
      iconArtUrl: buildRePoEArtUrl(iconDdsFile),
      mods: modRows.map((m) => {
        const mod = ref.prepare(`SELECT text FROM ${refTables().mods} WHERE id = ?`).get(m.mod_id) as { text: string } | undefined
        return {
          id: m.id,
          modId: m.mod_id,
          modText: mod?.text ?? m.mod_id,
          generationType: m.generation_type,
          slotIndex: m.slot_index,
        }
      }),
    }
  })
}

export function saveBuildItem(buildId: string, input: SaveBuildItemInput): BuildItem {
  const db = getUserDb()
  const pageId = input.pageId ?? getActiveEquipPageId(buildId)
  const existingBySlot = db
    .prepare('SELECT id FROM build_items WHERE build_id = ? AND slot_label = ? AND page_id = ?')
    .get(buildId, input.slotLabel, pageId) as { id: string } | undefined

  const existingById = input.id
    ? (db.prepare('SELECT id FROM build_items WHERE id = ?').get(input.id) as { id: string } | undefined)
    : undefined

  const id = existingBySlot?.id ?? existingById?.id ?? uuidv4()
  const isUpdate = Boolean(existingBySlot ?? existingById)

  if (isUpdate) {
    db.prepare(`
      UPDATE build_items SET
        build_id = ?,
        page_id = ?,
        budget_tier = ?,
        rarity = ?,
        unique_id = ?,
        base_item_id = ?,
        slot_label = ?,
        priority = ?,
        notes = ?
      WHERE id = ?
    `).run(
      buildId,
      pageId,
      'early',
      input.rarity,
      input.uniqueId ?? null,
      input.baseItemId ?? null,
      input.slotLabel,
      input.priority,
      input.notes ?? null,
      id,
    )
  } else {
    db.prepare(`
      INSERT INTO build_items (id, build_id, page_id, budget_tier, rarity, unique_id, base_item_id, slot_label, priority, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      buildId,
      pageId,
      'early',
      input.rarity,
      input.uniqueId ?? null,
      input.baseItemId ?? null,
      input.slotLabel,
      input.priority,
      input.notes ?? null,
    )
  }

  db.prepare('DELETE FROM build_item_mods WHERE build_item_id = ?').run(id)

  const insertMod = db.prepare(`
    INSERT INTO build_item_mods (id, build_item_id, mod_id, generation_type, slot_index)
    VALUES (?, ?, ?, ?, ?)
  `)

  for (const mod of input.mods) {
    insertMod.run(uuidv4(), id, mod.modId, mod.generationType, mod.slotIndex)
  }

  const saved = getBuildItems(buildId, pageId).find((i) => i.id === id)!
  if (input.slotLabel === 'weapon_main' && saved.isTwoHanded) {
    db.prepare("DELETE FROM build_items WHERE build_id = ? AND page_id = ? AND slot_label = 'weapon_off'").run(
      buildId,
      pageId,
    )
  }

  return saved
}

export function deleteBuildItem(buildItemId: string): void {
  getUserDb().prepare('DELETE FROM build_items WHERE id = ?').run(buildItemId)
}

export function getPassiveTrees(buildId: string): PassiveTreeSlot[] {
  const rows = getUserDb()
    .prepare('SELECT * FROM build_passive_trees WHERE build_id = ? AND slot_index < ? ORDER BY slot_index')
    .all(buildId, MAX_PASSIVE_TREES) as Array<{
    id: string
    build_id: string
    slot_index: number
    level_label: string
    image_path: string | null
    notes: string | null
  }>

  return rows.map((row) => ({
    id: row.id,
    buildId: row.build_id,
    slotIndex: row.slot_index,
    levelLabel: row.level_label,
    imageUrl:
      row.image_path && passiveTreeFileExists(row.image_path) ? toLocalAssetUrl(row.image_path) : null,
    notes: row.notes,
  }))
}

function assertPassiveTreeLevelLabel(levelLabel: string): void {
  if (!levelLabel.trim()) {
    throw new Error('Enter a level label for this passive tree.')
  }
}

function assertPassiveTreeSlotAvailable(buildId: string, slotIndex: number): void {
  if (slotIndex < 0 || slotIndex >= MAX_PASSIVE_TREES) {
    throw new Error(`Passive tree slot index must be between 0 and ${MAX_PASSIVE_TREES - 1}.`)
  }

  const db = getUserDb()
  const existing = db
    .prepare('SELECT id FROM build_passive_trees WHERE build_id = ? AND slot_index = ?')
    .get(buildId, slotIndex) as { id: string } | undefined
  if (existing) return

  const count = (db.prepare('SELECT COUNT(*) as c FROM build_passive_trees WHERE build_id = ?').get(buildId) as { c: number }).c
  if (count >= MAX_PASSIVE_TREES) {
    throw new Error(`Maximum ${MAX_PASSIVE_TREES} passive trees per build.`)
  }
}

function upsertPassiveTreeRow(
  buildId: string,
  slotIndex: number,
  levelLabel: string,
  notes: string | null,
  imagePath?: string | null,
): string {
  const db = getUserDb()
  const existing = db
    .prepare('SELECT id, image_path FROM build_passive_trees WHERE build_id = ? AND slot_index = ?')
    .get(buildId, slotIndex) as { id: string; image_path: string | null } | undefined

  const id = existing?.id ?? uuidv4()
  const storedImagePath = imagePath !== undefined ? imagePath : (existing?.image_path ?? null)

  db.prepare(`
    INSERT INTO build_passive_trees (id, build_id, slot_index, level_label, image_path, notes)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(build_id, slot_index) DO UPDATE SET
      level_label = excluded.level_label,
      image_path = excluded.image_path,
      notes = excluded.notes
  `).run(id, buildId, slotIndex, levelLabel, storedImagePath, notes)

  return id
}

export function savePassiveTreeSlot(buildId: string, input: SaveTreeSlotInput): PassiveTreeSlot {
  assertPassiveTreeSlotAvailable(buildId, input.slotIndex)
  assertPassiveTreeLevelLabel(input.levelLabel)
  upsertPassiveTreeRow(buildId, input.slotIndex, input.levelLabel.trim(), input.notes ?? null)
  return getPassiveTrees(buildId).find((t) => t.slotIndex === input.slotIndex)!
}

export function uploadPassiveTreeImage(
  buildId: string,
  slotIndex: number,
  sourcePath: string,
  meta: { levelLabel: string; notes?: string | null },
): PassiveTreeSlot {
  assertPassiveTreeSlotAvailable(buildId, slotIndex)
  assertPassiveTreeLevelLabel(meta.levelLabel)
  const relativePath = copyPassiveTreeImage(sourcePath, buildId, slotIndex)
  upsertPassiveTreeRow(buildId, slotIndex, meta.levelLabel.trim(), meta.notes ?? null, relativePath)
  return getPassiveTrees(buildId).find((t) => t.slotIndex === slotIndex)!
}

export function clearPassiveTreeImage(buildId: string, slotIndex: number): PassiveTreeSlot | null {
  removePassiveTreeImageFiles(buildId, slotIndex)
  const db = getUserDb()
  const existing = db
    .prepare('SELECT id FROM build_passive_trees WHERE build_id = ? AND slot_index = ?')
    .get(buildId, slotIndex) as { id: string } | undefined
  if (!existing) return null

  db.prepare('UPDATE build_passive_trees SET image_path = NULL WHERE id = ?').run(existing.id)
  return getPassiveTrees(buildId).find((t) => t.slotIndex === slotIndex) ?? null
}

export function deletePassiveTreeSlot(buildId: string, slotIndex: number): void {
  removePassiveTreeImageFiles(buildId, slotIndex)
  getUserDb()
    .prepare('DELETE FROM build_passive_trees WHERE build_id = ? AND slot_index = ?')
    .run(buildId, slotIndex)
}

export function searchGems(query: string, gemTypes?: string[]) {
  const q = query.trim()
  if (!q) return []
  const ref = getReferenceDb()
  if (gemTypes?.length) {
    const placeholders = gemTypes.map(() => '?').join(',')
    return ref
      .prepare(
        `SELECT id, name, gem_type as gemType, color FROM ${refTables().gems} WHERE name LIKE ? AND gem_type IN (${placeholders}) ORDER BY name LIMIT 30`,
      )
      .all(`%${q}%`, ...gemTypes) as Array<{ id: string; name: string; gemType: string; color: string | null }>
  }
  return ref
    .prepare(`SELECT id, name, gem_type as gemType, color FROM ${refTables().gems} WHERE name LIKE ? ORDER BY name LIMIT 30`)
    .all(`%${q}%`) as Array<{ id: string; name: string; gemType: string; color: string | null }>
}

export function getGemDetails(gemId: string) {
  const ref = getReferenceDb()
  const gem = ref
    .prepare(`SELECT id, name, gem_type as gemType, color, crafting_level as craftingLevel FROM ${refTables().gems} WHERE id = ?`)
    .get(gemId) as
    | { id: string; name: string; gemType: string; color: string | null; craftingLevel: number | null }
    | undefined
  if (!gem) return null
  const recommendedSupports =
    gem.gemType === 'active' || gem.gemType === 'spirit' ? resolveRecommendedSupports(ref, gemId) : []
  const tags = resolveGemTagLabels(ref, gemId)
  return { ...gem, tags, recommendedSupports }
}

export function searchUniques(query: string, slotLabel?: string) {
  const ref = getReferenceDb()
  const q = query.trim()
  const nameClause = q ? 'AND name LIKE ?' : ''
  const nameParam = q ? [`%${q}%`] : []

  if (slotLabel) {
    const slotId = normalizeSlotId(slotLabel)
    if (slotId) {
      const filter = getSlotSearchFilter(slotId)
      if (filter.kind === 'itemClass') {
        return ref
          .prepare(
            `SELECT id, name, item_class as itemClass, icon_dds_file as iconDdsFile FROM ${refTables().uniqueItems} WHERE item_class = ? ${nameClause} ORDER BY name LIMIT 50`,
          )
          .all(filter.itemClass, ...nameParam) as Array<{ id: string; name: string; itemClass: string }>
      }
      if (filter.kind === 'weaponMain') {
        return ref
          .prepare(
            `SELECT id, name, item_class as itemClass, icon_dds_file as iconDdsFile FROM ${refTables().uniqueItems} WHERE slot_group = 'weapon' ${nameClause} ORDER BY name LIMIT 50`,
          )
          .all(...nameParam) as Array<{ id: string; name: string; itemClass: string }>
      }
      if (filter.kind === 'weaponOff') {
        return ref
          .prepare(
            `SELECT id, name, item_class as itemClass, icon_dds_file as iconDdsFile FROM unique_items
             WHERE (item_class IN ('Shield', 'Buckler', 'Focus') OR slot_group = 'weapon') ${nameClause}
             ORDER BY name LIMIT 50`,
          )
          .all(...nameParam) as Array<{ id: string; name: string; itemClass: string }>
      }
    }
  }

  if (!q) return []
  return ref
    .prepare(`SELECT id, name, item_class as itemClass, icon_dds_file as iconDdsFile FROM ${refTables().uniqueItems} WHERE name LIKE ? ORDER BY name LIMIT 30`)
    .all(`%${q}%`) as Array<{ id: string; name: string; itemClass: string }>
}

export function searchBaseItems(query: string, slotLabel?: string) {
  const ref = getReferenceDb()
  const q = query.trim()
  const nameClause = q ? 'AND name LIKE ?' : ''
  const nameParam = q ? [`%${q}%`] : []

  if (slotLabel) {
    const slotId = normalizeSlotId(slotLabel)
    if (slotId) {
      const filter = getSlotSearchFilter(slotId)
      if (filter.kind === 'itemClass') {
        return ref
          .prepare(
            `SELECT id, name, item_class as itemClass, icon_dds_file as iconDdsFile FROM ${refTables().uniqueItems} WHERE item_class = ? ${nameClause} ORDER BY name LIMIT 50`,
          )
          .all(filter.itemClass, ...nameParam) as Array<{ id: string; name: string; itemClass: string }>
      }
      if (filter.kind === 'weaponMain') {
        return ref
          .prepare(
            `SELECT id, name, item_class as itemClass, icon_dds_file as iconDdsFile FROM base_items
             WHERE tags LIKE '%weapon%' ${nameClause}
             ORDER BY name LIMIT 50`,
          )
          .all(...nameParam) as Array<{ id: string; name: string; itemClass: string }>
      }
      if (filter.kind === 'weaponOff') {
        return ref
          .prepare(
            `SELECT id, name, item_class as itemClass, icon_dds_file as iconDdsFile FROM base_items
             WHERE (item_class IN ('Shield', 'Buckler', 'Focus') OR tags LIKE '%weapon%') ${nameClause}
             ORDER BY name LIMIT 50`,
          )
          .all(...nameParam) as Array<{ id: string; name: string; itemClass: string }>
      }
    }
  }

  if (!q) return []
  return ref
    .prepare(`SELECT id, name, item_class as itemClass, icon_dds_file as iconDdsFile FROM ${refTables().uniqueItems} WHERE name LIKE ? ORDER BY name LIMIT 30`)
    .all(`%${q}%`) as Array<{ id: string; name: string; itemClass: string }>
}

export function getItemTagsForSlot(slotLabel: string): string[] {
  const slotId = normalizeSlotId(slotLabel)
  if (!slotId) return []
  const filter = getSlotSearchFilter(slotId)
  const ref = getReferenceDb()
  if (filter.kind === 'itemClass') {
    const tags = ref
      .prepare('SELECT tag_id FROM item_class_default_tags WHERE item_class = ?')
      .all(filter.itemClass) as Array<{ tag_id: string }>
    return tags.map((t) => t.tag_id)
  }
  return []
}

export function getItemTagsForBuildItem(rarity: 'unique' | 'rare', uniqueId?: string | null, baseItemId?: string | null): string[] {
  const ref = getReferenceDb()
  if (rarity === 'rare' && baseItemId) {
    const row = ref.prepare(`SELECT tags FROM ${refTables().baseItems} WHERE id = ?`).get(baseItemId) as { tags: string } | undefined
    return row ? (JSON.parse(row.tags) as string[]) : []
  }
  if (rarity === 'unique' && uniqueId) {
    const unique = ref.prepare(`SELECT item_class FROM ${refTables().uniqueItems} WHERE id = ?`).get(uniqueId) as
      | { item_class: string }
      | undefined
    if (!unique) return []
    const tags = ref
      .prepare('SELECT tag_id FROM item_class_default_tags WHERE item_class = ?')
      .all(unique.item_class) as Array<{ tag_id: string }>
    return tags.map((t) => t.tag_id)
  }
  return []
}

export function searchMods(
  query: string,
  tags: string[],
  generationType: 'prefix' | 'suffix',
  excludeModIds: string[] = [],
) {
  const q = query.trim()
  if (!q) return []

  const ref = getReferenceDb()
  const excludeClause =
    excludeModIds.length > 0 ? `AND m.id NOT IN (${excludeModIds.map(() => '?').join(',')})` : ''
  const excludeParams = excludeModIds

  if (tags.length === 0) {
    const excludeNoTag = excludeModIds.length > 0 ? `AND id NOT IN (${excludeModIds.map(() => '?').join(',')})` : ''
    return ref
      .prepare(
        `SELECT id, text, required_level as requiredLevel FROM ${refTables().gems} WHERE generation_type = ? AND text LIKE ? ${excludeNoTag} LIMIT 40`,
      )
      .all(generationType, `%${q}%`, ...excludeParams) as Array<{ id: string; text: string; requiredLevel: number | null }>
  }

  const placeholders = tags.map(() => '?').join(',')
  return ref
    .prepare(
      `
    SELECT DISTINCT m.id, m.text, m.required_level as requiredLevel
    FROM  m
    JOIN mod_spawn_tags mst ON mst.mod_id = m.id
    WHERE m.generation_type = ?
      AND m.text LIKE ?
      AND mst.weight > 0
      AND mst.tag_id IN (${placeholders})
      ${excludeClause}
    LIMIT 40
  `,
    )
    .all(generationType, `%${q}%`, ...tags, ...excludeParams) as Array<{ id: string; text: string; requiredLevel: number | null }>
}

export function exportBuildPayload(buildId: string) {
  const profile = getUserDb().prepare('SELECT * FROM build_profiles WHERE id = ?').get(buildId) as BuildRow
  if (!profile) throw new Error('Build not found')

  const gemPages = getBuildGemPages(buildId).map((page) => ({
    id: page.id,
    title: page.title,
    sortOrder: page.sortOrder,
    isActive: page.isActive,
    gemGroups: getBuildGemGroups(buildId, page.id).map((group) => ({
      id: group.id,
      sortOrder: group.sortOrder,
      notes: group.notes,
      mainGemId: group.mainGem?.gemId ?? null,
      linkedGems: group.linkedGems.map((g) => ({ gemId: g.gemId, notes: g.notes })),
    })),
  }))

  const equipPages = getBuildEquipPages(buildId).map((page) => ({
    id: page.id,
    title: page.title,
    sortOrder: page.sortOrder,
    isActive: page.isActive,
    items: getBuildItems(buildId, page.id).map((item) => ({
      id: item.id,
      rarity: item.rarity,
      uniqueId: item.uniqueId,
      baseItemId: item.baseItemId,
      slotLabel: item.slotLabel,
      priority: item.priority,
      notes: item.notes,
      mods: item.mods.map((m) => ({
        modId: m.modId,
        generationType: m.generationType,
        slotIndex: m.slotIndex,
      })),
    })),
  }))

  const passiveTrees = getUserDb()
    .prepare('SELECT slot_index as slotIndex, level_label as levelLabel, notes FROM build_passive_trees WHERE build_id = ?')
    .all(buildId)

  const objectiveProgress = getUserDb()
    .prepare(
      'SELECT objective_id as objectiveId, is_completed as isCompleted FROM campaign_objective_progress WHERE is_completed = 1',
    )
    .all()

  return {
    v: 6,
    build: {
      name: profile.name,
      className: profile.class_name,
      notes: profile.notes,
      activeBudgetTier: profile.active_budget_tier,
      gemPages,
      equipPages,
      passiveTrees,
      objectiveProgress,
    },
  }
}

export function importBuildPayload(payload: { build: Record<string, unknown> }): BuildProfile {
  const b = payload.build
  const profile = createBuild(String(b.name ?? 'Imported Build'), b.className ? String(b.className) : undefined)
  const db = getUserDb()

  if (b.notes) {
    db.prepare('UPDATE build_profiles SET notes = ? WHERE id = ?').run(String(b.notes), profile.id)
  }
  if (b.activeBudgetTier) {
    db.prepare('UPDATE build_profiles SET active_budget_tier = ? WHERE id = ?').run(String(b.activeBudgetTier), profile.id)
  }

  const gemPagesRaw = (b.gemPages as Array<Record<string, unknown>> | undefined) ?? []
  if (gemPagesRaw.length > 0) {
    const pages: SaveGemPageInput[] = gemPagesRaw.map((page, index) => ({
      title: String(page.title ?? `Page ${index + 1}`),
      sortOrder: Number(page.sortOrder ?? index),
      isActive: Boolean(page.isActive),
      gemGroups: ((page.gemGroups as Array<Record<string, unknown>>) ?? []).map((group) => ({
        mainGemId: String(group.mainGemId),
        linkedGems: ((group.linkedGems as Array<Record<string, unknown>>) ?? []).map((g) => ({
          gemId: String(g.gemId),
          notes: g.notes ? String(g.notes) : null,
        })),
        notes: group.notes ? String(group.notes) : null,
      })),
    }))
    saveBuildGemPagesPoB(profile.id, pages)
  } else {
    const pageId = ensureDefaultGemPage(profile.id)
    const gemGroups = (b.gemGroups as Array<Record<string, unknown>> | undefined) ?? []
    if (gemGroups.length > 0) {
      for (const group of gemGroups) {
        saveBuildGemGroup(profile.id, {
          id: group.id ? String(group.id) : undefined,
          pageId,
          mainGemId: String(group.mainGemId),
          linkedGems: ((group.linkedGems as Array<Record<string, unknown>>) ?? []).map((g) => ({
            gemId: String(g.gemId),
            notes: g.notes ? String(g.notes) : null,
          })),
          notes: group.notes ? String(group.notes) : null,
        })
      }
    } else {
      for (const gem of (b.gems as Array<Record<string, unknown>>) ?? []) {
        const slotType = String(gem.slotType)
        if (slotType !== 'active') continue
        saveBuildGemGroup(profile.id, {
          pageId,
          mainGemId: String(gem.gemId),
          linkedGems: [],
          notes: gem.notes ? String(gem.notes) : null,
        })
      }
    }
  }

  const equipPagesRaw = (b.equipPages as Array<Record<string, unknown>> | undefined) ?? []
  if (equipPagesRaw.length > 0) {
    const pages: SaveEquipPageInput[] = equipPagesRaw.map((page, index) => ({
      title: String(page.title ?? `Page ${index + 1}`),
      sortOrder: Number(page.sortOrder ?? index),
      isActive: Boolean(page.isActive),
      items: ((page.items as Array<Record<string, unknown>>) ?? []).map((item) => ({
        rarity: item.rarity as 'unique' | 'rare',
        uniqueId: item.uniqueId ? String(item.uniqueId) : null,
        baseItemId: item.baseItemId ? String(item.baseItemId) : null,
        slotLabel: String(item.slotLabel),
        priority: Number(item.priority ?? 0),
        notes: item.notes ? String(item.notes) : null,
        mods: ((item.mods as Array<Record<string, unknown>>) ?? []).map((m) => ({
          modId: String(m.modId),
          generationType: m.generationType as 'prefix' | 'suffix',
          slotIndex: Number(m.slotIndex),
        })),
      })),
    }))
    saveBuildEquipPagesPoB(profile.id, pages)
  } else {
    const legacyItems = (b.items as Array<Record<string, unknown>>) ?? []
    if (legacyItems.length > 0) {
      const tierTitles: Record<string, string> = {
        early: 'Early Budget',
        medium: 'Medium Budget',
        high: 'High Budget',
      }
      const activeTier = String(b.activeBudgetTier ?? 'early')
      const tiers = ['early', 'medium', 'high']
      const pages: SaveEquipPageInput[] = tiers.map((tier, index) => ({
        title: tierTitles[tier],
        sortOrder: index,
        isActive: tier === activeTier,
        items: legacyItems
          .filter((item) => String(item.budgetTier ?? 'early') === tier)
          .map((item) => ({
            rarity: item.rarity as 'unique' | 'rare',
            uniqueId: item.uniqueId ? String(item.uniqueId) : null,
            baseItemId: item.baseItemId ? String(item.baseItemId) : null,
            slotLabel: String(item.slotLabel),
            priority: Number(item.priority ?? 0),
            notes: item.notes ? String(item.notes) : null,
            mods: ((item.mods as Array<Record<string, unknown>>) ?? []).map((m) => ({
              modId: String(m.modId),
              generationType: m.generationType as 'prefix' | 'suffix',
              slotIndex: Number(m.slotIndex),
            })),
          })),
      }))
      saveBuildEquipPagesPoB(profile.id, pages)
    } else {
      ensureDefaultEquipPage(profile.id)
    }
  }

  for (const tree of ((b.passiveTrees as Array<Record<string, unknown>>) ?? []).slice(0, MAX_PASSIVE_TREES)) {
    const levelLabel = tree.levelLabel ? String(tree.levelLabel).trim() : ''
    if (!levelLabel) continue
    savePassiveTreeSlot(profile.id, {
      slotIndex: Number(tree.slotIndex),
      levelLabel,
      notes: tree.notes ? String(tree.notes) : null,
    })
  }

  const completedObjectiveIds = (b.objectiveProgress as Array<Record<string, unknown>> | undefined)
    ?.filter((prog) => prog.isCompleted)
    .map((prog) => String(prog.objectiveId))
    .filter(Boolean) ?? []

  if (completedObjectiveIds.length > 0) {
    importCompletedObjectiveIds(completedObjectiveIds)
  }

  return getActiveBuild()!
}
