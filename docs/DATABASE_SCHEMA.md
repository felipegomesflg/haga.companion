# Database Schema

HAGA Overlay uses **SQLite** with two logical databases:

| Database | File | Purpose |
|----------|------|---------|
| **Reference** | `reference.db` | Read-only game catalog — shipped with app |
| **User** | `user.db` | Builds, item mod configs, progress, settings |

Both live in `%APPDATA%/HAGAOverlay/` (production) or `./data/` (development).

---

## Reference Database (`reference.db`)

### `gems`

Seeded from [`skill_gems.json`](https://repoe-fork.github.io/poe2/skill_gems.json).

```sql
CREATE TABLE gems (
  id                  TEXT PRIMARY KEY,    -- Metadata/Items/Gem/SkillGemFireball
  name                TEXT NOT NULL,       -- base_item.display_name
  gem_type            TEXT NOT NULL,       -- active | support | spirit
  color               TEXT,                -- r | g | b | w
  crafting_level      INTEGER,
  crafting_types      TEXT,                -- JSON array
  tags                TEXT,                -- JSON array of tag ids
  icon_dds_file       TEXT,
  recommended_supports TEXT,               -- JSON array of gem ids
  requirement_weights TEXT,                -- JSON: { str, dex, int }
  release_state       TEXT,
  is_deprecated       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_gems_type ON gems(gem_type);
CREATE INDEX idx_gems_name ON gems(name);
```

### `gem_tags`

Lookup table from [`gem_tags.json`](https://repoe-fork.github.io/poe2/gem_tags.json).

```sql
CREATE TABLE gem_tags (
  id            TEXT PRIMARY KEY,          -- e.g. "fire"
  display_label TEXT                       -- e.g. "[Fire]" or null
);
```

### `unique_items`

Seeded from [`uniques.json`](https://repoe-fork.github.io/poe2/uniques.json).

```sql
CREATE TABLE unique_items (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  item_class      TEXT NOT NULL,
  slot_group      TEXT NOT NULL,           -- weapon | armour | accessory | jewel | charm
  icon_dds_file   TEXT,
  is_deprecated   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_uniques_class ON unique_items(item_class);
CREATE INDEX idx_uniques_name ON unique_items(name);
```

### `item_classes`

Seeded from [`item_classes.json`](https://repoe-fork.github.io/poe2/item_classes.json).

```sql
CREATE TABLE item_classes (
  id              TEXT PRIMARY KEY,        -- e.g. "Body Armour"
  name            TEXT NOT NULL,           -- e.g. "Body Armours"
  category        TEXT,
  category_id     TEXT
);
```

### `item_tags`

Seeded from [`tags.json`](https://repoe-fork.github.io/poe2/tags.json).

```sql
CREATE TABLE item_tags (
  id              TEXT PRIMARY KEY           -- e.g. "ring", "str_armour"
);
```

### `base_items`

Seeded from [`base_items.json`](https://repoe-fork.github.io/poe2/base_items.json).

```sql
CREATE TABLE base_items (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  item_class      TEXT NOT NULL,
  drop_level      INTEGER,
  tags            TEXT NOT NULL,           -- JSON array
  implicits       TEXT,                    -- JSON array of mod ids
  properties      TEXT,                    -- JSON: armour, damage, etc.
  icon_dds_file   TEXT,
  release_state   TEXT,
  is_deprecated   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_base_items_class ON base_items(item_class);
CREATE INDEX idx_base_items_name ON base_items(name);
CREATE INDEX idx_base_items_drop ON base_items(drop_level);
```

### `mods`

Seeded from [`mods.json`](https://repoe-fork.github.io/poe2/mods.json).

```sql
CREATE TABLE mods (
  id                TEXT PRIMARY KEY,      -- e.g. "Strength1"
  generation_type   TEXT NOT NULL,         -- prefix | suffix
  mod_groups        TEXT NOT NULL,         -- JSON array — same group cannot repeat
  name              TEXT,                  -- e.g. "of the Brute"
  required_level    INTEGER,
  text              TEXT NOT NULL,         -- "+(5-8) to Strength"
  stats             TEXT,                  -- JSON array: { id, min, max }
  implicit_tags     TEXT,                  -- JSON array
  is_essence_only   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_mods_gen_type ON mods(generation_type);
CREATE INDEX idx_mods_level ON mods(required_level);
```

### `mod_spawn_tags`

Junction table for fast mod ↔ item tag correlation.

```sql
CREATE TABLE mod_spawn_tags (
  mod_id          TEXT NOT NULL,
  tag_id          TEXT NOT NULL,
  weight          INTEGER NOT NULL,
  PRIMARY KEY (mod_id, tag_id),
  FOREIGN KEY (mod_id) REFERENCES mods(id)
);

CREATE INDEX idx_mod_spawn_tag ON mod_spawn_tags(tag_id, weight);
```

Populated from `mods.json → spawn_weights[]` where `weight > 0`.

### `item_class_default_tags`

Maps unique item classes to spawn tags (for mod filtering when no base item is selected).

```sql
CREATE TABLE item_class_default_tags (
  item_class      TEXT NOT NULL,
  tag_id          TEXT NOT NULL,
  PRIMARY KEY (item_class, tag_id)
);
```

Example: `Ring` → `ring`, `Helmet` → `helmet`, `Body Armour` → `body_armour`, `str_armour`.

### `campaign_acts` / `campaign_objectives`

Unchanged — see previous version. 6 acts, objectives seeded by you.

---

## User Database (`user.db`)

### `build_profiles`

```sql
CREATE TABLE build_profiles (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  class_name          TEXT,
  notes               TEXT,
  active_budget_tier  TEXT NOT NULL DEFAULT 'early',  -- early | medium | high (Equips overlay default)
  is_active           INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
```

### `build_gems`

```sql
CREATE TABLE build_gems (
  id            TEXT PRIMARY KEY,
  build_id      TEXT NOT NULL,
  gem_id        TEXT NOT NULL,
  slot_type     TEXT NOT NULL,             -- active | support
  slot_index    INTEGER NOT NULL,
  notes         TEXT,
  FOREIGN KEY (build_id) REFERENCES build_profiles(id) ON DELETE CASCADE
);
```

### `build_items`

Replaces `build_uniques`. Supports both **unique** and **rare** items with editable mods.

```sql
CREATE TABLE build_items (
  id              TEXT PRIMARY KEY,
  build_id        TEXT NOT NULL,
  budget_tier     TEXT NOT NULL,           -- early | medium | high
  rarity          TEXT NOT NULL,           -- unique | rare
  unique_id       TEXT,                    -- FK → unique_items (when rarity=unique)
  base_item_id    TEXT,                    -- FK → base_items (when rarity=rare)
  slot_label      TEXT NOT NULL,           -- e.g. "Helmet", "Weapon 1", "Ring 2"
  priority        INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,
  FOREIGN KEY (build_id) REFERENCES build_profiles(id) ON DELETE CASCADE,
  UNIQUE(build_id, slot_label, budget_tier)
);

CREATE INDEX idx_build_items_build ON build_items(build_id, budget_tier, priority);
```

Display name resolved at runtime:

- `rarity = unique` → `unique_items.name`
- `rarity = rare` → `base_items.name` (shown as "Rare: Plate Vest")

### `build_item_mods`

Up to **3 prefixes** and **3 suffixes** per build item.

```sql
CREATE TABLE build_item_mods (
  id              TEXT PRIMARY KEY,
  build_item_id   TEXT NOT NULL,
  mod_id          TEXT NOT NULL,           -- FK → reference.mods.id
  generation_type TEXT NOT NULL,           -- prefix | suffix
  slot_index      INTEGER NOT NULL,        -- 0..2 within type (max 3 each)
  FOREIGN KEY (build_item_id) REFERENCES build_items(id) ON DELETE CASCADE,
  UNIQUE(build_item_id, generation_type, slot_index)
);
```

**Constraints enforced in application layer:**

| Rule | Enforcement |
|------|-------------|
| Max 3 prefixes | `slot_index` 0..2 where `generation_type = prefix` |
| Max 3 suffixes | `slot_index` 0..2 where `generation_type = suffix` |
| No duplicate mod groups | Check `mods.mod_groups` overlap before save |
| Mod must be valid for item | Filter via `mod_spawn_tags` ∩ item tags |

### `build_passive_trees`

Up to 4 passive tree slots. Images hosted on Imgur — store page URL, display via embed iframe.

```sql
CREATE TABLE build_passive_trees (
  id              TEXT PRIMARY KEY,
  build_id        TEXT NOT NULL,
  slot_index      INTEGER NOT NULL,          -- 0..3
  level_label     TEXT NOT NULL,
  imgur_url       TEXT,                      -- e.g. https://imgur.com/abc123
  notes           TEXT,
  FOREIGN KEY (build_id) REFERENCES build_profiles(id) ON DELETE CASCADE,
  UNIQUE(build_id, slot_index)
);
```

Display: `https://imgur.com/{id}/embed` in iframe. See `src/lib/imgur.ts`.

### `build_objective_progress` / `build_custom_objectives`

Unchanged.

### `app_settings`

Unchanged — includes hotkey configuration.

---

## Mod correlation query (reference)

Given a build item, resolve eligible mods:

```sql
-- Example: rare item with tags from base_items
SELECT m.*
FROM mods m
JOIN mod_spawn_tags mst ON mst.mod_id = m.id
WHERE m.generation_type = 'prefix'
  AND mst.weight > 0
  AND mst.tag_id IN ('body_armour', 'str_armour', 'armour', 'default')
GROUP BY m.id
ORDER BY m.required_level, m.text;
```

For uniques, tags come from `item_class_default_tags` mapped by `unique_items.item_class`.

---

## Export / Import

### Share code payload (v3 — no images)

```json
{
  "v": 3,
  "build": {
    "name": "Cold Sorc Leveling",
    "className": "Sorceress",
    "notes": "...",
    "activeBudgetTier": "early",
    "gems": [...],
    "items": [
      {
        "budgetTier": "early",
        "rarity": "rare",
        "baseItemId": "Metadata/Items/Armours/BodyArmours/BodyStr1",
        "slotLabel": "Body Armour",
        "notes": "Life + res until unique",
        "mods": [
          { "modId": "LocalIncreasedLife1", "generationType": "prefix", "slotIndex": 0 }
        ]
      },
      {
        "budgetTier": "high",
        "rarity": "unique",
        "uniqueId": "151",
        "slotLabel": "Amulet",
        "mods": []
      }
    ],
    "passiveTrees": [
      { "slotIndex": 0, "levelLabel": "Level 10", "imgurUrl": "https://imgur.com/abc123", "notes": "..." }
    ],
    "objectiveProgress": [...],
    "customObjectives": [...]
  }
}
```

No `imageBase64` — tree slots use **Imgur URLs** in share code.

### `.haga` bundle (optional)

ZIP containing `build.json` only. Tree images remain on Imgur.

---

## Seed data files (repo)

```
haga-overlay/
├── data/
│   ├── seeds/
│   │   ├── skill_gems.json         ← RePoE
│   │   ├── uniques.json            ← RePoE
│   │   ├── base_items.json         ← RePoE
│   │   ├── mods.json               ← RePoE
│   │   ├── item_classes.json       ← RePoE
│   │   ├── tags.json               ← RePoE
│   │   ├── gem_tags.json           ← RePoE
│   │   └── campaign_objectives.json ← YOU provide
│   └── reference.db                ← generated
└── scripts/
    └── seed-game-data.ts
```

### npm script (planned)

```json
"seed:data": "tsx scripts/seed-game-data.ts"
```
