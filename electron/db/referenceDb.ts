import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { getJsonSeedDir, getPtJsonSeedDir, getReferenceDbPath, readJsonSeedFile } from './paths'

let referenceDb: Database.Database | null = null

function readJsonFile(fileName: string): unknown | null {
  const filePath = path.join(getJsonSeedDir(), fileName)
  if (!fs.existsSync(filePath)) {
    console.warn(`[seed] Missing ${fileName}`)
    return null
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function createReferenceSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS gems (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      gem_type TEXT NOT NULL,
      color TEXT,
      crafting_level INTEGER,
      crafting_types TEXT,
      tags TEXT,
      icon_dds_file TEXT,
      recommended_supports TEXT,
      release_state TEXT,
      is_deprecated INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_gems_type ON gems(gem_type);
    CREATE INDEX IF NOT EXISTS idx_gems_name ON gems(name);

    CREATE TABLE IF NOT EXISTS gem_tags (
      id TEXT PRIMARY KEY,
      display_label TEXT
    );

    CREATE TABLE IF NOT EXISTS unique_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      item_class TEXT NOT NULL,
      slot_group TEXT NOT NULL,
      icon_dds_file TEXT,
      is_deprecated INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_uniques_class ON unique_items(item_class);
    CREATE INDEX IF NOT EXISTS idx_uniques_name ON unique_items(name);

    CREATE TABLE IF NOT EXISTS item_classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      category_id TEXT
    );

    CREATE TABLE IF NOT EXISTS base_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      item_class TEXT NOT NULL,
      drop_level INTEGER,
      tags TEXT NOT NULL,
      icon_dds_file TEXT,
      is_deprecated INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_base_items_class ON base_items(item_class);
    CREATE INDEX IF NOT EXISTS idx_base_items_name ON base_items(name);

    CREATE TABLE IF NOT EXISTS mods (
      id TEXT PRIMARY KEY,
      generation_type TEXT NOT NULL,
      mod_groups TEXT NOT NULL,
      name TEXT,
      required_level INTEGER,
      text TEXT NOT NULL,
      stats TEXT,
      is_essence_only INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_mods_gen_type ON mods(generation_type);

    CREATE TABLE IF NOT EXISTS mod_spawn_tags (
      mod_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      weight INTEGER NOT NULL,
      PRIMARY KEY (mod_id, tag_id)
    );
    CREATE INDEX IF NOT EXISTS idx_mod_spawn_tag ON mod_spawn_tags(tag_id, weight);

    CREATE TABLE IF NOT EXISTS item_class_default_tags (
      item_class TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (item_class, tag_id)
    );

    CREATE TABLE IF NOT EXISTS campaign_arcs (
      id TEXT PRIMARY KEY,
      act_number INTEGER NOT NULL,
      name TEXT NOT NULL,
      tab_label TEXT,
      description TEXT,
      sort_order INTEGER NOT NULL,
      is_available INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_campaign_arcs_sort ON campaign_arcs(sort_order);

    CREATE TABLE IF NOT EXISTS campaign_objectives (
      id TEXT PRIMARY KEY,
      arc_id TEXT NOT NULL,
      act_number INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      is_optional INTEGER NOT NULL DEFAULT 0,
      objective_type TEXT,
      reward_tags TEXT,
      expected_zone_name TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_objectives_arc ON campaign_objectives(arc_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_objectives_act ON campaign_objectives(act_number, sort_order);

    CREATE TABLE IF NOT EXISTS campaign_arcs_pt (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tab_label TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS campaign_objectives_pt (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS gems_pt (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      gem_type TEXT NOT NULL,
      color TEXT,
      crafting_level INTEGER,
      crafting_types TEXT,
      tags TEXT,
      icon_dds_file TEXT,
      recommended_supports TEXT,
      release_state TEXT,
      is_deprecated INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_gems_pt_type ON gems_pt(gem_type);
    CREATE INDEX IF NOT EXISTS idx_gems_pt_name ON gems_pt(name);

    CREATE TABLE IF NOT EXISTS gem_tags_pt (
      id TEXT PRIMARY KEY,
      display_label TEXT
    );

    CREATE TABLE IF NOT EXISTS unique_items_pt (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      item_class TEXT NOT NULL,
      slot_group TEXT NOT NULL,
      icon_dds_file TEXT,
      is_deprecated INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_uniques_pt_class ON unique_items_pt(item_class);
    CREATE INDEX IF NOT EXISTS idx_uniques_pt_name ON unique_items_pt(name);

    CREATE TABLE IF NOT EXISTS item_classes_pt (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      category_id TEXT
    );

    CREATE TABLE IF NOT EXISTS base_items_pt (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      item_class TEXT NOT NULL,
      drop_level INTEGER,
      tags TEXT NOT NULL,
      icon_dds_file TEXT,
      is_deprecated INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_base_items_pt_class ON base_items_pt(item_class);
    CREATE INDEX IF NOT EXISTS idx_base_items_pt_name ON base_items_pt(name);

    CREATE TABLE IF NOT EXISTS mods_pt (
      id TEXT PRIMARY KEY,
      generation_type TEXT NOT NULL,
      mod_groups TEXT NOT NULL,
      name TEXT,
      required_level INTEGER,
      text TEXT NOT NULL,
      stats TEXT,
      is_essence_only INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_mods_pt_gen_type ON mods_pt(generation_type);
  `)
}

function seedDefaultItemClassTags(db: Database.Database): void {
  const tags: Record<string, string[]> = {
    Ring: ['ring'],
    Amulet: ['amulet'],
    Belt: ['belt'],
    Helmet: ['helmet', 'armour'],
    'Body Armour': ['body_armour', 'armour'],
    Gloves: ['gloves', 'armour'],
    Boots: ['boots', 'armour'],
    Shield: ['shield', 'armour'],
    Buckler: ['buckler', 'armour'],
    Quiver: ['quiver'],
    Jewel: ['jewel'],
    Focus: ['focus'],
    Wand: ['wand'],
    Staff: ['staff'],
    Bow: ['bow'],
    Crossbow: ['crossbow'],
    Spear: ['spear'],
    Flail: ['flail'],
    Dagger: ['dagger'],
    Claw: ['claw'],
    'One Hand Sword': ['sword', 'onehand'],
    'Two Hand Sword': ['sword', 'twohand'],
    'One Hand Axe': ['axe', 'onehand'],
    'Two Hand Axe': ['axe', 'twohand'],
    'One Hand Mace': ['mace', 'onehand'],
    'Two Hand Mace': ['mace', 'twohand'],
    Sceptre: ['sceptre'],
    Warstaff: ['staff'],
  }

  const insert = db.prepare(
    'INSERT OR IGNORE INTO item_class_default_tags (item_class, tag_id) VALUES (?, ?)',
  )
  for (const [itemClass, tagIds] of Object.entries(tags)) {
    for (const tagId of tagIds) insert.run(itemClass, tagId)
  }
}

function importGemTags(db: Database.Database, data: Record<string, string | null>): void {
  const insert = db.prepare('INSERT OR REPLACE INTO gem_tags (id, display_label) VALUES (?, ?)')
  const tx = db.transaction(() => {
    for (const [id, label] of Object.entries(data)) {
      insert.run(id, label)
    }
  })
  tx()
}

function importItemClasses(db: Database.Database, data: Record<string, Record<string, unknown>>): void {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO item_classes (id, name, category, category_id)
    VALUES (@id, @name, @category, @category_id)
  `)
  const tx = db.transaction((entries: [string, Record<string, unknown>][]) => {
    for (const [id, row] of entries) {
      if (!row.name || String(row.name).trim() === '') continue
      insert.run({
        id,
        name: String(row.name),
        category: row.category ? String(row.category) : null,
        category_id: row.category_id ? String(row.category_id) : null,
      })
    }
  })
  tx(Object.entries(data))
}

function syncCampaignFromSeed(db: Database.Database): void {
  const campaign = readJsonFile('campaign_objectives.json') as CampaignSeed | null
  if (!campaign?.objectives?.length) return
  importCampaign(db, campaign)
}

function syncCampaignExpectedZones(db: Database.Database): void {
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='campaign_objectives'")
    .get() as { name: string } | undefined
  if (!table) return

  const cols = db.prepare('PRAGMA table_info(campaign_objectives)').all() as Array<{ name: string }>
  if (!cols.some((c) => c.name === 'expected_zone_name')) {
    db.exec('ALTER TABLE campaign_objectives ADD COLUMN expected_zone_name TEXT')
  }

  const campaign = readJsonFile('campaign_objectives.json') as CampaignSeed | null
  if (!campaign?.objectives?.length) return

  const update = db.prepare(`
    UPDATE campaign_objectives
    SET expected_zone_name = ?
    WHERE id = ? AND (expected_zone_name IS NULL OR expected_zone_name != ?)
  `)

  const tx = db.transaction(() => {
    for (const obj of campaign.objectives!) {
      if (!obj.expectedZoneName) continue
      update.run(obj.expectedZoneName, obj.id, obj.expectedZoneName)
    }
  })
  tx()
}

function migrateReferenceSchema(db: Database.Database): void {
  const gemCols = db.prepare('PRAGMA table_info(gems)').all() as Array<{ name: string }>
  if (!gemCols.some((c) => c.name === 'recommended_supports')) {
    db.exec('ALTER TABLE gems ADD COLUMN recommended_supports TEXT')
    const skillGems = readJsonFile('skill_gems.json') as Record<string, unknown> | null
    if (skillGems) {
      const update = db.prepare('UPDATE gems SET recommended_supports = ? WHERE id = ?')
      const tx = db.transaction((entries: [string, Record<string, unknown>][]) => {
        for (const [id, gem] of entries) {
          if (gem.recommended_supports) {
            update.run(JSON.stringify(gem.recommended_supports), id)
          }
        }
      })
      tx(Object.entries(skillGems) as [string, Record<string, unknown>][])
    }
  }

  const arcTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='campaign_arcs'")
    .get() as { name: string } | undefined
  const objCols = db.prepare('PRAGMA table_info(campaign_objectives)').all() as Array<{ name: string }>
  const needsCampaignV2 = !arcTable || !objCols.some((c) => c.name === 'arc_id')

  if (needsCampaignV2) {
    db.exec(`
      DROP TABLE IF EXISTS campaign_objectives;
      DROP TABLE IF EXISTS campaign_acts;
      DROP TABLE IF EXISTS campaign_arcs;
    `)
    db.exec(`
      CREATE TABLE campaign_arcs (
        id TEXT PRIMARY KEY,
        act_number INTEGER NOT NULL,
        name TEXT NOT NULL,
        tab_label TEXT,
        description TEXT,
        sort_order INTEGER NOT NULL,
        is_available INTEGER NOT NULL DEFAULT 1
      );
      CREATE INDEX idx_campaign_arcs_sort ON campaign_arcs(sort_order);

      CREATE TABLE campaign_objectives (
        id TEXT PRIMARY KEY,
        arc_id TEXT NOT NULL,
        act_number INTEGER NOT NULL,
        sort_order INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        is_optional INTEGER NOT NULL DEFAULT 0,
        objective_type TEXT,
        reward_tags TEXT,
        expected_zone_name TEXT
      );
      CREATE INDEX idx_objectives_arc ON campaign_objectives(arc_id, sort_order);
      CREATE INDEX idx_objectives_act ON campaign_objectives(act_number, sort_order);
    `)
    const campaign = readJsonFile('campaign_objectives.json') as CampaignSeed | null
    if (campaign) importCampaign(db, campaign)
  }

  syncCampaignFromSeed(db)
  syncCampaignPtFromSeed(db)
  syncPtReferenceFromSeed(db)
}

function importSkillGems(db: Database.Database, data: Record<string, unknown>): void {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO gems
      (id, name, gem_type, color, crafting_level, crafting_types, tags, icon_dds_file, recommended_supports, release_state, is_deprecated)
    VALUES (@id, @name, @gem_type, @color, @crafting_level, @crafting_types, @tags, @icon_dds_file, @recommended_supports, @release_state, 0)
  `)

  const tx = db.transaction((entries: [string, Record<string, unknown>][]) => {
    for (const [id, gem] of entries) {
      const baseItem = gem.base_item as { display_name?: string; release_state?: string } | undefined
      insert.run({
        id,
        name: baseItem?.display_name ?? id,
        gem_type: gem.gem_type ?? 'active',
        color: gem.color ?? null,
        crafting_level: gem.crafting_level ?? null,
        crafting_types: JSON.stringify(gem.crafting_types ?? []),
        tags: JSON.stringify(gem.tags ?? []),
        icon_dds_file: gem.icon_dds_file ?? null,
        recommended_supports: gem.recommended_supports ? JSON.stringify(gem.recommended_supports) : null,
        release_state: baseItem?.release_state ?? null,
      })
    }
  })

  tx(Object.entries(data) as [string, Record<string, unknown>][])
}

function importUniques(db: Database.Database, data: Record<string, unknown>): void {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO unique_items (id, name, item_class, slot_group, icon_dds_file, is_deprecated)
    VALUES (@id, @name, @item_class, @slot_group, @icon_dds_file, 0)
  `)

  const slotGroup = (itemClass: string): string => {
    if (['Ring', 'Amulet', 'Belt'].includes(itemClass)) return 'accessory'
    if (itemClass === 'Jewel') return 'jewel'
    if (['Helmet', 'Body Armour', 'Gloves', 'Boots', 'Shield', 'Buckler', 'Focus'].includes(itemClass))
      return 'armour'
    return 'weapon'
  }

  const tx = db.transaction((entries: [string, Record<string, unknown>][]) => {
    for (const [id, item] of entries) {
      const itemClass = String(item.item_class ?? 'Other')
      const visual = item.visual_identity as { dds_file?: string } | undefined
      insert.run({
        id,
        name: String(item.name ?? id),
        item_class: itemClass,
        slot_group: slotGroup(itemClass),
        icon_dds_file: visual?.dds_file ?? null,
      })
    }
  })

  tx(Object.entries(data) as [string, Record<string, unknown>][])
}

function importBaseItems(db: Database.Database, data: Record<string, unknown>): void {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO base_items
      (id, name, item_class, drop_level, tags, icon_dds_file, is_deprecated)
    VALUES (@id, @name, @item_class, @drop_level, @tags, @icon_dds_file, 0)
  `)

  const tx = db.transaction((entries: [string, Record<string, unknown>][]) => {
    for (const [id, item] of entries) {
      const visual = item.visual_identity as { dds_file?: string } | undefined
      insert.run({
        id,
        name: String(item.name ?? id),
        item_class: String(item.item_class ?? 'Other'),
        drop_level: (item.drop_level as number | undefined) ?? null,
        tags: JSON.stringify(item.tags ?? []),
        icon_dds_file: visual?.dds_file ?? null,
      })
    }
  })

  tx(Object.entries(data) as [string, Record<string, unknown>][])
}

function importMods(db: Database.Database, data: Record<string, unknown>): void {
  db.prepare('DELETE FROM mod_spawn_tags').run()

  const insertMod = db.prepare(`
    INSERT OR REPLACE INTO mods
      (id, generation_type, mod_groups, name, required_level, text, stats, is_essence_only)
    VALUES (@id, @generation_type, @mod_groups, @name, @required_level, @text, @stats, @is_essence_only)
  `)

  const insertSpawn = db.prepare(`
    INSERT OR REPLACE INTO mod_spawn_tags (mod_id, tag_id, weight) VALUES (?, ?, ?)
  `)

  const tx = db.transaction((entries: [string, Record<string, unknown>][]) => {
    for (const [id, mod] of entries) {
      insertMod.run({
        id,
        generation_type: mod.generation_type,
        mod_groups: JSON.stringify(mod.groups ?? []),
        name: mod.name ?? null,
        required_level: mod.required_level ?? null,
        text: String(mod.text ?? id),
        stats: JSON.stringify(mod.stats ?? []),
        is_essence_only: mod.is_essence_only ? 1 : 0,
      })

      const weights = (mod.spawn_weights as Array<{ tag: string; weight: number }>) ?? []
      for (const sw of weights) {
        if (sw.weight > 0) insertSpawn.run(id, sw.tag, sw.weight)
      }
    }
  })

  tx(Object.entries(data) as [string, Record<string, unknown>][])
}

type CampaignSeed = {
  version?: number
  arcs?: Array<{
    id: string
    actNumber: number
    name: string
    tabLabel?: string
    description?: string
    sortOrder?: number
    isAvailable?: boolean
  }>
  /** @deprecated v1 flat act list */
  acts?: Array<{ actNumber: number; name: string; isAvailable?: boolean }>
  objectives?: Array<{
    id: string
    arcId?: string
    actNumber: number
    sortOrder: number
    title: string
    description?: string
    isOptional?: boolean
    objectiveType?: string
    rewardTags?: string[]
    expectedZoneName?: string | null
  }>
}

function importCampaignPt(db: Database.Database, data: CampaignSeed): void {
  db.prepare('DELETE FROM campaign_objectives_pt').run()
  db.prepare('DELETE FROM campaign_arcs_pt').run()

  const insertArc = db.prepare(`
    INSERT OR REPLACE INTO campaign_arcs_pt (id, name, tab_label, description)
    VALUES (?, ?, ?, ?)
  `)

  const insertObj = db.prepare(`
    INSERT OR REPLACE INTO campaign_objectives_pt (id, title, description)
    VALUES (?, ?, ?)
  `)

  for (const arc of data.arcs ?? []) {
    insertArc.run(arc.id, arc.name, arc.tabLabel ?? arc.name, arc.description ?? null)
  }

  for (const obj of data.objectives ?? []) {
    insertObj.run(obj.id, obj.title, obj.description ?? null)
  }
}

function importPtReferenceData(db: Database.Database): void {
  const ptDir = getPtJsonSeedDir()
  console.log(`[seed] Loading PT JSON from ${ptDir}`)

  const gemTags = readJsonSeedFile('gem_tags.json', 'pt-BR') as Record<string, string | null> | null
  if (gemTags) {
    const insert = db.prepare('INSERT OR REPLACE INTO gem_tags_pt (id, display_label) VALUES (?, ?)')
    const tx = db.transaction(() => {
      for (const [id, label] of Object.entries(gemTags)) insert.run(id, label)
    })
    tx()
  }

  const itemClasses = readJsonSeedFile('item_classes.json', 'pt-BR') as Record<string, Record<string, unknown>> | null
  if (itemClasses) {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO item_classes_pt (id, name, category, category_id)
      VALUES (@id, @name, @category, @category_id)
    `)
    const tx = db.transaction((entries: [string, Record<string, unknown>][]) => {
      for (const [id, row] of entries) {
        if (!row.name || String(row.name).trim() === '') continue
        insert.run({
          id,
          name: String(row.name),
          category: row.category ? String(row.category) : null,
          category_id: row.category_id ? String(row.category_id) : null,
        })
      }
    })
    tx(Object.entries(itemClasses))
  }

  const skillGems = readJsonSeedFile('skill_gems.json', 'pt-BR') as Record<string, unknown> | null
  if (skillGems) {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO gems_pt
        (id, name, gem_type, color, crafting_level, crafting_types, tags, icon_dds_file, recommended_supports, release_state, is_deprecated)
      VALUES (@id, @name, @gem_type, @color, @crafting_level, @crafting_types, @tags, @icon_dds_file, @recommended_supports, @release_state, 0)
    `)
    const tx = db.transaction((entries: [string, Record<string, unknown>][]) => {
      for (const [id, gem] of entries) {
        const baseItem = gem.base_item as { display_name?: string; release_state?: string } | undefined
        insert.run({
          id,
          name: baseItem?.display_name ?? id,
          gem_type: gem.gem_type ?? 'active',
          color: gem.color ?? null,
          crafting_level: gem.crafting_level ?? null,
          crafting_types: JSON.stringify(gem.crafting_types ?? []),
          tags: JSON.stringify(gem.tags ?? []),
          icon_dds_file: gem.icon_dds_file ?? null,
          recommended_supports: gem.recommended_supports ? JSON.stringify(gem.recommended_supports) : null,
          release_state: baseItem?.release_state ?? null,
        })
      }
    })
    tx(Object.entries(skillGems) as [string, Record<string, unknown>][])
  }

  const uniques = readJsonSeedFile('uniques.json', 'pt-BR') as Record<string, unknown> | null
  if (uniques) {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO unique_items_pt (id, name, item_class, slot_group, icon_dds_file, is_deprecated)
      VALUES (@id, @name, @item_class, @slot_group, @icon_dds_file, 0)
    `)
    const slotGroup = (itemClass: string): string => {
      if (['Ring', 'Amulet', 'Belt'].includes(itemClass)) return 'accessory'
      if (itemClass === 'Jewel') return 'jewel'
      if (['Helmet', 'Body Armour', 'Gloves', 'Boots', 'Shield', 'Buckler', 'Focus'].includes(itemClass))
        return 'armour'
      return 'weapon'
    }
    const tx = db.transaction((entries: [string, Record<string, unknown>][]) => {
      for (const [id, item] of entries) {
        const itemClass = String(item.item_class ?? 'Other')
        const visual = item.visual_identity as { dds_file?: string } | undefined
        insert.run({
          id,
          name: String(item.name ?? id),
          item_class: itemClass,
          slot_group: slotGroup(itemClass),
          icon_dds_file: visual?.dds_file ?? null,
        })
      }
    })
    tx(Object.entries(uniques) as [string, Record<string, unknown>][])
  }

  const baseItems = readJsonSeedFile('base_items.json', 'pt-BR') as Record<string, unknown> | null
  if (baseItems) {
    const insert = db.prepare(`
      INSERT OR REPLACE INTO base_items_pt
        (id, name, item_class, drop_level, tags, icon_dds_file, is_deprecated)
      VALUES (@id, @name, @item_class, @drop_level, @tags, @icon_dds_file, 0)
    `)
    const tx = db.transaction((entries: [string, Record<string, unknown>][]) => {
      for (const [id, item] of entries) {
        const visual = item.visual_identity as { dds_file?: string } | undefined
        insert.run({
          id,
          name: String(item.name ?? id),
          item_class: String(item.item_class ?? 'Other'),
          drop_level: (item.drop_level as number | undefined) ?? null,
          tags: JSON.stringify(item.tags ?? []),
          icon_dds_file: visual?.dds_file ?? null,
        })
      }
    })
    tx(Object.entries(baseItems) as [string, Record<string, unknown>][])
  }

  const mods = readJsonSeedFile('mods.json', 'pt-BR') as Record<string, unknown> | null
  if (mods) {
    const insertMod = db.prepare(`
      INSERT OR REPLACE INTO mods_pt
        (id, generation_type, mod_groups, name, required_level, text, stats, is_essence_only)
      VALUES (@id, @generation_type, @mod_groups, @name, @required_level, @text, @stats, @is_essence_only)
    `)
    const tx = db.transaction((entries: [string, Record<string, unknown>][]) => {
      for (const [id, mod] of entries) {
        insertMod.run({
          id,
          generation_type: mod.generation_type,
          mod_groups: JSON.stringify(mod.groups ?? []),
          name: mod.name ?? null,
          required_level: mod.required_level ?? null,
          text: String(mod.text ?? id),
          stats: JSON.stringify(mod.stats ?? []),
          is_essence_only: mod.is_essence_only ? 1 : 0,
        })
      }
    })
    tx(Object.entries(mods) as [string, Record<string, unknown>][])
  }

  const campaignPt = readJsonFile('campaign_objectives_pt.json') as CampaignSeed | null
  if (campaignPt) importCampaignPt(db, campaignPt)
}

function syncCampaignPtFromSeed(db: Database.Database): void {
  const campaignPt = readJsonFile('campaign_objectives_pt.json') as CampaignSeed | null
  if (!campaignPt?.objectives?.length) return
  importCampaignPt(db, campaignPt)
}

function syncPtReferenceFromSeed(db: Database.Database): void {
  importPtReferenceData(db)
}

function importCampaign(db: Database.Database, data: CampaignSeed): void {
  db.exec('DROP TABLE IF EXISTS campaign_acts')
  db.prepare('DELETE FROM campaign_objectives').run()
  db.prepare('DELETE FROM campaign_arcs').run()

  const insertArc = db.prepare(`
    INSERT OR REPLACE INTO campaign_arcs
      (id, act_number, name, tab_label, description, sort_order, is_available)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const insertObj = db.prepare(`
    INSERT OR REPLACE INTO campaign_objectives
      (id, arc_id, act_number, sort_order, title, description, is_optional, objective_type, reward_tags, expected_zone_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const arcRows = data.arcs?.length
    ? data.arcs
    : data.acts?.map((act, index) => ({
        id: act.actNumber === 5 ? `act5-legacy-${index}` : `act${act.actNumber}`,
        actNumber: act.actNumber,
        name: act.name,
        tabLabel: act.name,
        description: null as string | null,
        sortOrder: act.actNumber * 10,
        isAvailable: act.isAvailable,
      }))

  if (arcRows?.length) {
    for (const arc of arcRows) {
      insertArc.run(
        arc.id,
        arc.actNumber,
        arc.name,
        arc.tabLabel ?? arc.name,
        arc.description ?? null,
        arc.sortOrder ?? arc.actNumber * 10,
        arc.isAvailable !== false ? 1 : 0,
      )
    }
  } else {
    for (let n = 1; n <= 6; n++) {
      insertArc.run(`act${n}`, n, n === 6 ? 'Act 6 — Coming soon' : `Act ${n}`, `Act ${n}`, null, n * 10, n <= 5 ? 1 : 0)
    }
  }

  if (data.objectives?.length) {
    for (const obj of data.objectives) {
      const arcId = obj.arcId ?? `act${obj.actNumber}`
      insertObj.run(
        obj.id,
        arcId,
        obj.actNumber,
        obj.sortOrder,
        obj.title,
        obj.description ?? null,
        obj.isOptional ? 1 : 0,
        obj.objectiveType ?? null,
        obj.rewardTags?.length ? JSON.stringify(obj.rewardTags) : null,
        obj.expectedZoneName ?? null,
      )
    }
  }
}

export function seedReferenceData(db: Database.Database): void {
  console.log(`[seed] Loading JSON from ${getJsonSeedDir()}`)

  seedDefaultItemClassTags(db)

  const gemTags = readJsonFile('gem_tags.json') as Record<string, string | null> | null
  if (gemTags) importGemTags(db, gemTags)

  const itemClasses = readJsonFile('item_classes.json') as Record<string, Record<string, unknown>> | null
  if (itemClasses) importItemClasses(db, itemClasses)

  const skillGems = readJsonFile('skill_gems.json') as Record<string, unknown> | null
  if (skillGems) importSkillGems(db, skillGems)

  const uniques = readJsonFile('uniques.json') as Record<string, unknown> | null
  if (uniques) importUniques(db, uniques)

  const baseItems = readJsonFile('base_items.json') as Record<string, unknown> | null
  if (baseItems) importBaseItems(db, baseItems)

  const mods = readJsonFile('mods.json') as Record<string, unknown> | null
  if (mods) importMods(db, mods)

  const campaign = readJsonFile('campaign_objectives.json') as CampaignSeed | null
  if (campaign) importCampaign(db, campaign)

  importPtReferenceData(db)

  const counts = {
    gems: (db.prepare('SELECT COUNT(*) as c FROM gems').get() as { c: number }).c,
    uniques: (db.prepare('SELECT COUNT(*) as c FROM unique_items').get() as { c: number }).c,
    baseItems: (db.prepare('SELECT COUNT(*) as c FROM base_items').get() as { c: number }).c,
    mods: (db.prepare('SELECT COUNT(*) as c FROM mods').get() as { c: number }).c,
    objectives: (db.prepare('SELECT COUNT(*) as c FROM campaign_objectives').get() as { c: number }).c,
    arcs: (db.prepare('SELECT COUNT(*) as c FROM campaign_arcs').get() as { c: number }).c,
  }

  console.log('[seed] reference.db counts:', counts)
}

export function rebuildReferenceDb(): Database.Database {
  closeReferenceDb()

  const dbPath = getReferenceDbPath()
  if (fs.existsSync(dbPath)) {
    try {
      fs.unlinkSync(dbPath)
      console.log(`[seed] Deleted ${dbPath}`)
    } catch (error) {
      console.warn(`[seed] Could not delete ${dbPath} (in use?) — syncing campaign in place`)
      referenceDb = new Database(dbPath)
      referenceDb.pragma('journal_mode = WAL')
      createReferenceSchema(referenceDb)
      migrateReferenceSchema(referenceDb)
      syncCampaignFromSeed(referenceDb)
      syncCampaignPtFromSeed(referenceDb)
      syncPtReferenceFromSeed(referenceDb)
      return referenceDb
    }
  }

  referenceDb = new Database(dbPath)
  referenceDb.pragma('journal_mode = WAL')
  createReferenceSchema(referenceDb)
  seedReferenceData(referenceDb)
  return referenceDb
}

export function getReferenceDb(): Database.Database {
  if (!referenceDb) {
    const dbPath = getReferenceDbPath()
    const isNew = !fs.existsSync(dbPath)

    referenceDb = new Database(dbPath)
    referenceDb.pragma('journal_mode = WAL')
    createReferenceSchema(referenceDb)

    if (isNew) {
      seedReferenceData(referenceDb)
    } else {
      migrateReferenceSchema(referenceDb)
      const gemCount = (referenceDb.prepare('SELECT COUNT(*) as c FROM gems').get() as { c: number }).c
      if (gemCount === 0) seedReferenceData(referenceDb)
    }
  }
  return referenceDb
}

export function closeReferenceDb(): void {
  referenceDb?.close()
  referenceDb = null
}
