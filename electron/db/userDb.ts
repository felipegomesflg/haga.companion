import Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { getUserDbPath } from './paths'

let userDb: Database.Database | null = null

const DEFAULT_SETTINGS: Record<string, string> = {
  locale: 'en',
  hotkeyToggleBuildPanel: 'CommandOrControl+Shift+B',
  hotkeyToggleCampaignPanel: 'CommandOrControl+Shift+C',
  hotkeyToggleHud: 'CommandOrControl+Shift+H',
  hotkeyToggleClickThrough: 'CommandOrControl+Shift+O',
  hotkeyOpenSettings: 'CommandOrControl+Shift+Space',
  overlayHudAlwaysVisible: 'true',
  overlayClickThroughDefault: 'true',
  overlayOpacity: '0.9',
  buildPanelDockSide: 'right',
  campaignAutoDetectAct: 'true',
  clientLogPath: '',
}

function createUserSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS build_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      class_name TEXT,
      notes TEXT,
      active_budget_tier TEXT NOT NULL DEFAULT 'early',
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS build_gem_pages (
      id TEXT PRIMARY KEY,
      build_id TEXT NOT NULL,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (build_id) REFERENCES build_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS build_gem_groups (
      id TEXT PRIMARY KEY,
      build_id TEXT NOT NULL,
      page_id TEXT,
      sort_order INTEGER NOT NULL,
      notes TEXT,
      FOREIGN KEY (build_id) REFERENCES build_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (page_id) REFERENCES build_gem_pages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS build_gems (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      gem_id TEXT NOT NULL,
      link_index INTEGER NOT NULL,
      notes TEXT,
      FOREIGN KEY (group_id) REFERENCES build_gem_groups(id) ON DELETE CASCADE,
      UNIQUE(group_id, link_index)
    );

    CREATE TABLE IF NOT EXISTS build_equip_pages (
      id TEXT PRIMARY KEY,
      build_id TEXT NOT NULL,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (build_id) REFERENCES build_profiles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS build_items (
      id TEXT PRIMARY KEY,
      build_id TEXT NOT NULL,
      page_id TEXT,
      budget_tier TEXT NOT NULL DEFAULT 'early',
      rarity TEXT NOT NULL,
      unique_id TEXT,
      base_item_id TEXT,
      slot_label TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (build_id) REFERENCES build_profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (page_id) REFERENCES build_equip_pages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS build_item_mods (
      id TEXT PRIMARY KEY,
      build_item_id TEXT NOT NULL,
      mod_id TEXT NOT NULL,
      generation_type TEXT NOT NULL,
      slot_index INTEGER NOT NULL,
      FOREIGN KEY (build_item_id) REFERENCES build_items(id) ON DELETE CASCADE,
      UNIQUE(build_item_id, generation_type, slot_index)
    );

    CREATE TABLE IF NOT EXISTS build_passive_trees (
      id TEXT PRIMARY KEY,
      build_id TEXT NOT NULL,
      slot_index INTEGER NOT NULL,
      level_label TEXT NOT NULL,
      image_path TEXT,
      notes TEXT,
      FOREIGN KEY (build_id) REFERENCES build_profiles(id) ON DELETE CASCADE,
      UNIQUE(build_id, slot_index)
    );

    CREATE TABLE IF NOT EXISTS build_objective_progress (
      id TEXT PRIMARY KEY,
      build_id TEXT NOT NULL,
      objective_id TEXT NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      FOREIGN KEY (build_id) REFERENCES build_profiles(id) ON DELETE CASCADE,
      UNIQUE(build_id, objective_id)
    );

    CREATE TABLE IF NOT EXISTS campaign_objective_progress (
      objective_id TEXT PRIMARY KEY,
      is_completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}

function seedDefaults(db: Database.Database): void {
  const insertSetting = db.prepare('INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)')
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    insertSetting.run(key, value)
  }

  const count = db.prepare('SELECT COUNT(*) as c FROM build_profiles').get() as { c: number }
  if (count.c > 0) return

  const now = new Date().toISOString()
  const buildId = uuidv4()
  db.prepare(`
    INSERT INTO build_profiles (id, name, class_name, notes, active_budget_tier, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'early', 1, ?, ?)
  `).run(buildId, 'Default Build', 'Sorceress', '', now, now)
}

function migratePassiveTrees(db: Database.Database): void {
  const cols = db.prepare('PRAGMA table_info(build_passive_trees)').all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === 'image_path')) {
    db.exec('ALTER TABLE build_passive_trees ADD COLUMN image_path TEXT')
  }
  db.prepare('DELETE FROM build_passive_trees WHERE slot_index >= 3').run()
}

function migrateBuildCharacterTracking(db: Database.Database): void {
  const cols = db.prepare('PRAGMA table_info(build_profiles)').all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === 'game_character_name')) {
    db.exec('ALTER TABLE build_profiles ADD COLUMN game_character_name TEXT')
  }
  if (!cols.some((c) => c.name === 'tracked_character_level')) {
    db.exec('ALTER TABLE build_profiles ADD COLUMN tracked_character_level INTEGER')
  }
}

function migrateLegacyGems(db: Database.Database): void {
  const cols = db.prepare('PRAGMA table_info(build_gems)').all() as Array<{ name: string }>
  if (cols.some((c) => c.name === 'group_id')) return
  if (!cols.some((c) => c.name === 'slot_type')) return

  db.exec(`
    CREATE TABLE IF NOT EXISTS build_gem_groups (
      id TEXT PRIMARY KEY,
      build_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      notes TEXT,
      FOREIGN KEY (build_id) REFERENCES build_profiles(id) ON DELETE CASCADE
    );
  `)

  const oldRows = db.prepare('SELECT * FROM build_gems').all() as Array<{
    id: string
    build_id: string
    gem_id: string
    slot_type: string
    slot_index: number
    notes: string | null
  }>

  db.exec(`
    CREATE TABLE build_gems_new (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      gem_id TEXT NOT NULL,
      link_index INTEGER NOT NULL,
      notes TEXT,
      FOREIGN KEY (group_id) REFERENCES build_gem_groups(id) ON DELETE CASCADE,
      UNIQUE(group_id, link_index)
    );
  `)

  const actives = oldRows.filter((r) => r.slot_type === 'active').sort((a, b) => a.slot_index - b.slot_index)
  const supports = oldRows.filter((r) => r.slot_type === 'support').sort((a, b) => a.slot_index - b.slot_index)
  const groupIds: string[] = []

  for (let i = 0; i < actives.length; i++) {
    const active = actives[i]
    const groupId = uuidv4()
    groupIds.push(groupId)
    db.prepare('INSERT INTO build_gem_groups (id, build_id, sort_order, notes) VALUES (?, ?, ?, NULL)').run(
      groupId,
      active.build_id,
      i,
    )
    db.prepare('INSERT INTO build_gems_new (id, group_id, gem_id, link_index, notes) VALUES (?, ?, ?, 0, ?)').run(
      active.id,
      groupId,
      active.gem_id,
      active.notes,
    )
  }

  const linkCounts = new Array(groupIds.length).fill(0)
  let groupIdx = 0
  for (const support of supports) {
    if (groupIds.length === 0) break
    while (groupIdx < groupIds.length && linkCounts[groupIdx] >= 5) groupIdx++
    if (groupIdx >= groupIds.length) break
    linkCounts[groupIdx]++
    db.prepare('INSERT INTO build_gems_new (id, group_id, gem_id, link_index, notes) VALUES (?, ?, ?, ?, ?)').run(
      support.id,
      groupIds[groupIdx],
      support.gem_id,
      linkCounts[groupIdx],
      support.notes,
    )
    if (linkCounts[groupIdx] >= 5) groupIdx++
  }

  db.exec('DROP TABLE build_gems')
  db.exec('ALTER TABLE build_gems_new RENAME TO build_gems')
}

function migrateGemPages(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS build_gem_pages (
      id TEXT PRIMARY KEY,
      build_id TEXT NOT NULL,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (build_id) REFERENCES build_profiles(id) ON DELETE CASCADE
    );
  `)

  const groupCols = db.prepare('PRAGMA table_info(build_gem_groups)').all() as Array<{ name: string }>
  if (!groupCols.some((c) => c.name === 'page_id')) {
    db.exec('ALTER TABLE build_gem_groups ADD COLUMN page_id TEXT')
  }

  const builds = db.prepare('SELECT id FROM build_profiles').all() as Array<{ id: string }>
  for (const { id: buildId } of builds) {
    const pageCount = (
      db.prepare('SELECT COUNT(*) as c FROM build_gem_pages WHERE build_id = ?').get(buildId) as { c: number }
    ).c
    if (pageCount > 0) continue

    const pageId = uuidv4()
    db.prepare(
      'INSERT INTO build_gem_pages (id, build_id, title, sort_order, is_active) VALUES (?, ?, ?, 0, 1)',
    ).run(pageId, buildId, 'Default')

    db.prepare('UPDATE build_gem_groups SET page_id = ? WHERE build_id = ? AND page_id IS NULL').run(pageId, buildId)
  }

  const orphanGroups = db
    .prepare('SELECT DISTINCT build_id FROM build_gem_groups WHERE page_id IS NULL')
    .all() as Array<{ build_id: string }>
  for (const { build_id: buildId } of orphanGroups) {
    let pageId = (
      db.prepare('SELECT id FROM build_gem_pages WHERE build_id = ? ORDER BY sort_order LIMIT 1').get(buildId) as
        | { id: string }
        | undefined
    )?.id
    if (!pageId) {
      pageId = uuidv4()
      db.prepare(
        'INSERT INTO build_gem_pages (id, build_id, title, sort_order, is_active) VALUES (?, ?, ?, 0, 1)',
      ).run(pageId, buildId, 'Default')
    }
    db.prepare('UPDATE build_gem_groups SET page_id = ? WHERE build_id = ? AND page_id IS NULL').run(pageId, buildId)
  }
}

const LEGACY_BUDGET_PAGE_TITLES: Record<string, string> = {
  early: 'Early Budget',
  medium: 'Medium Budget',
  high: 'High Budget',
}

function migrateEquipPages(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS build_equip_pages (
      id TEXT PRIMARY KEY,
      build_id TEXT NOT NULL,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (build_id) REFERENCES build_profiles(id) ON DELETE CASCADE
    );
  `)

  const itemCols = db.prepare('PRAGMA table_info(build_items)').all() as Array<{ name: string }>
  if (!itemCols.some((c) => c.name === 'page_id')) {
    db.exec('ALTER TABLE build_items ADD COLUMN page_id TEXT')
  }

  const builds = db
    .prepare('SELECT id, active_budget_tier FROM build_profiles')
    .all() as Array<{ id: string; active_budget_tier: string }>

  for (const { id: buildId, active_budget_tier: activeTier } of builds) {
    const pageCount = (
      db.prepare('SELECT COUNT(*) as c FROM build_equip_pages WHERE build_id = ?').get(buildId) as { c: number }
    ).c
    if (pageCount > 0) continue

    const itemCount = (
      db.prepare('SELECT COUNT(*) as c FROM build_items WHERE build_id = ?').get(buildId) as { c: number }
    ).c

    if (itemCount === 0) {
      const pageId = uuidv4()
      db.prepare(
        'INSERT INTO build_equip_pages (id, build_id, title, sort_order, is_active) VALUES (?, ?, ?, 0, 1)',
      ).run(pageId, buildId, 'Default')
      continue
    }

    const tierOrder = ['early', 'medium', 'high'] as const
    const tierToPageId = new Map<string, string>()
    tierOrder.forEach((tier, sortOrder) => {
      const pageId = uuidv4()
      tierToPageId.set(tier, pageId)
      const isActive = tier === (activeTier || 'early')
      db.prepare(
        'INSERT INTO build_equip_pages (id, build_id, title, sort_order, is_active) VALUES (?, ?, ?, ?, ?)',
      ).run(pageId, buildId, LEGACY_BUDGET_PAGE_TITLES[tier], sortOrder, isActive ? 1 : 0)
    })

    for (const tier of tierOrder) {
      const pageId = tierToPageId.get(tier)!
      db.prepare('UPDATE build_items SET page_id = ? WHERE build_id = ? AND budget_tier = ?').run(
        pageId,
        buildId,
        tier,
      )
    }
  }

  const orphanItems = db
    .prepare('SELECT DISTINCT build_id FROM build_items WHERE page_id IS NULL')
    .all() as Array<{ build_id: string }>
  for (const { build_id: buildId } of orphanItems) {
    let pageId = (
      db.prepare('SELECT id FROM build_equip_pages WHERE build_id = ? ORDER BY sort_order LIMIT 1').get(buildId) as
        | { id: string }
        | undefined
    )?.id
    if (!pageId) {
      pageId = uuidv4()
      db.prepare(
        'INSERT INTO build_equip_pages (id, build_id, title, sort_order, is_active) VALUES (?, ?, ?, 0, 1)',
      ).run(pageId, buildId, 'Default')
    }
    db.prepare('UPDATE build_items SET page_id = ? WHERE build_id = ? AND page_id IS NULL').run(pageId, buildId)
  }
}

function migrateGlobalCampaignProgress(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_objective_progress (
      objective_id TEXT PRIMARY KEY,
      is_completed INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT
    );
  `)

  const globalCount = db.prepare('SELECT COUNT(*) as c FROM campaign_objective_progress').get() as { c: number }
  if (globalCount.c > 0) return

  const legacyRows = db
    .prepare(
      `
    SELECT objective_id, MAX(is_completed) as is_completed, MAX(completed_at) as completed_at
    FROM build_objective_progress
    GROUP BY objective_id
  `,
    )
    .all() as Array<{ objective_id: string; is_completed: number; completed_at: string | null }>

  const insert = db.prepare(`
    INSERT OR IGNORE INTO campaign_objective_progress (objective_id, is_completed, completed_at)
    VALUES (?, ?, ?)
  `)

  for (const row of legacyRows) {
    if (row.is_completed !== 1) continue
    insert.run(row.objective_id, 1, row.completed_at)
  }
}

export function getUserDb(): Database.Database {
  if (!userDb) {
    userDb = new Database(getUserDbPath())
    userDb.pragma('journal_mode = WAL')
    userDb.pragma('foreign_keys = ON')
    createUserSchema(userDb)
    migratePassiveTrees(userDb)
    migrateLegacyGems(userDb)
    migrateGemPages(userDb)
    migrateEquipPages(userDb)
    migrateBuildCharacterTracking(userDb)
    migrateGlobalCampaignProgress(userDb)
    seedDefaults(userDb)
  }
  return userDb
}

export function closeUserDb(): void {
  userDb?.close()
  userDb = null
}

export function getSetting(db: Database.Database, key: string): string {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? DEFAULT_SETTINGS[key] ?? ''
}

export function setSetting(db: Database.Database, key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run(key, value)
}

export function getActiveBuildId(db: Database.Database): string | null {
  const row = db.prepare('SELECT id FROM build_profiles WHERE is_active = 1 LIMIT 1').get() as
    | { id: string }
    | undefined
  return row?.id ?? null
}
