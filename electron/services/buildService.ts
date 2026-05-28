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
  BuildGemGroup,
  BuildGemLink,
  BuildItem,
  BuildProfile,
  PassiveTreeSlot,
  RecommendedSupportGem,
} from '../../src/types/build'
import type { PersistBuildDraftInput, SaveBuildItemInput, SaveGemGroupInput, SaveTreeSlotInput } from '../../src/types/ipc'
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
    budgetTier: input.budgetTier,
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
    { id: groupId, build_id: buildId, sort_order: sortOrder, notes: input.notes ?? null },
    gemRows,
  )
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

  db.prepare('UPDATE build_profiles SET active_budget_tier = ?, updated_at = ? WHERE id = ?').run(
    input.budgetTier,
    now,
    buildId,
  )

  clearBuildGemGroups(buildId)
  input.gemGroups.forEach((group, sortOrder) => {
    saveBuildGemGroupPoB(buildId!, {
      sortOrder,
      mainGemId: group.mainGemId,
      linkedGemIds: group.linkedGems.map((gem) => gem.gemId).slice(0, 5),
      notes: group.notes ?? null,
    })
  })

  db.prepare('DELETE FROM build_items WHERE build_id = ?').run(buildId)
  for (const item of input.items) {
    saveBuildItem(buildId, item)
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
  group: { id: string; build_id: string; sort_order: number; notes: string | null },
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
    sortOrder: group.sort_order,
    notes: group.notes,
    mainGem,
    linkedGems,
    recommendedSupports,
  }
}

export function getBuildGemGroups(buildId: string): BuildGemGroup[] {
  const ref = getReferenceDb()
  const db = getUserDb()
  const groups = db
    .prepare('SELECT * FROM build_gem_groups WHERE build_id = ? ORDER BY sort_order')
    .all(buildId) as Array<{ id: string; build_id: string; sort_order: number; notes: string | null }>

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
  const sortOrder = existingGroup
    ? ((db.prepare('SELECT sort_order FROM build_gem_groups WHERE id = ?').get(groupId) as { sort_order: number }).sort_order)
    : ((db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 as next FROM build_gem_groups WHERE build_id = ?').get(buildId) as { next: number }).next)

  if (existingGroup) {
    db.prepare('UPDATE build_gem_groups SET notes = ? WHERE id = ?').run(input.notes ?? null, groupId)
    db.prepare('DELETE FROM build_gems WHERE group_id = ?').run(groupId)
  } else {
    db.prepare('INSERT INTO build_gem_groups (id, build_id, sort_order, notes) VALUES (?, ?, ?, ?)').run(
      groupId,
      buildId,
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

  return getBuildGemGroups(buildId).find((g) => g.id === groupId)!
}

export function deleteBuildGemGroup(groupId: string): void {
  getUserDb().prepare('DELETE FROM build_gem_groups WHERE id = ?').run(groupId)
}

export function clearBuildGemGroups(buildId: string): void {
  getUserDb().prepare('DELETE FROM build_gem_groups WHERE build_id = ?').run(buildId)
}

export function saveBuildGemGroupPoB(
  buildId: string,
  input: { sortOrder: number; mainGemId: string; linkedGemIds: string[]; notes?: string | null },
): void {
  const db = getUserDb()
  const groupId = uuidv4()
  db.prepare('INSERT INTO build_gem_groups (id, build_id, sort_order, notes) VALUES (?, ?, ?, ?)').run(
    groupId,
    buildId,
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

export function getBuildItems(buildId: string, budgetTier: BudgetTier): BuildItem[] {
  const ref = getReferenceDb()
  const user = getUserDb()

  const rows = user
    .prepare('SELECT * FROM build_items WHERE build_id = ? AND budget_tier = ? ORDER BY priority, slot_label')
    .all(buildId, budgetTier) as Array<{
    id: string
    build_id: string
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
  const existingBySlot = db
    .prepare('SELECT id FROM build_items WHERE build_id = ? AND slot_label = ? AND budget_tier = ?')
    .get(buildId, input.slotLabel, input.budgetTier) as { id: string } | undefined

  const existingById = input.id
    ? (db.prepare('SELECT id FROM build_items WHERE id = ?').get(input.id) as { id: string } | undefined)
    : undefined

  const id = existingBySlot?.id ?? existingById?.id ?? uuidv4()
  const isUpdate = Boolean(existingBySlot ?? existingById)

  if (isUpdate) {
    db.prepare(`
      UPDATE build_items SET
        build_id = ?,
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
      input.budgetTier,
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
      INSERT INTO build_items (id, build_id, budget_tier, rarity, unique_id, base_item_id, slot_label, priority, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      buildId,
      input.budgetTier,
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

  const saved = getBuildItems(buildId, input.budgetTier).find((i) => i.id === id)!
  if (input.slotLabel === 'weapon_main' && saved.isTwoHanded) {
    db.prepare(
      "DELETE FROM build_items WHERE build_id = ? AND budget_tier = ? AND slot_label = 'weapon_off'",
    ).run(buildId, input.budgetTier)
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

  const gemGroups = getBuildGemGroups(buildId).map((group) => ({
    id: group.id,
    sortOrder: group.sortOrder,
    notes: group.notes,
    mainGemId: group.mainGem?.gemId ?? null,
    linkedGems: group.linkedGems.map((g) => ({ gemId: g.gemId, notes: g.notes })),
  }))

  const itemsRaw = getUserDb().prepare('SELECT * FROM build_items WHERE build_id = ?').all(buildId) as Array<{
    budget_tier: BudgetTier
    rarity: 'unique' | 'rare'
    unique_id: string | null
    base_item_id: string | null
    slot_label: string
    priority: number
    notes: string | null
    id: string
  }>

  const items = itemsRaw.map((item) => {
    const mods = getUserDb()
      .prepare('SELECT mod_id as modId, generation_type as generationType, slot_index as slotIndex FROM build_item_mods WHERE build_item_id = ?')
      .all(item.id)
    return {
      budgetTier: item.budget_tier,
      rarity: item.rarity,
      uniqueId: item.unique_id,
      baseItemId: item.base_item_id,
      slotLabel: item.slot_label,
      priority: item.priority,
      notes: item.notes,
      mods,
    }
  })

  const passiveTrees = getUserDb()
    .prepare('SELECT slot_index as slotIndex, level_label as levelLabel, notes FROM build_passive_trees WHERE build_id = ?')
    .all(buildId)

  const objectiveProgress = getUserDb()
    .prepare(
      'SELECT objective_id as objectiveId, is_completed as isCompleted FROM campaign_objective_progress WHERE is_completed = 1',
    )
    .all()

  return {
    v: 4,
    build: {
      name: profile.name,
      className: profile.class_name,
      notes: profile.notes,
      activeBudgetTier: profile.active_budget_tier,
      gemGroups,
      items,
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

  const gemGroups = (b.gemGroups as Array<Record<string, unknown>> | undefined) ?? []
  if (gemGroups.length > 0) {
    for (const group of gemGroups) {
      saveBuildGemGroup(profile.id, {
        id: group.id ? String(group.id) : undefined,
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
        mainGemId: String(gem.gemId),
        linkedGems: [],
        notes: gem.notes ? String(gem.notes) : null,
      })
    }
  }

  for (const item of (b.items as Array<Record<string, unknown>>) ?? []) {
    saveBuildItem(profile.id, {
      budgetTier: item.budgetTier as BudgetTier,
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
    })
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
