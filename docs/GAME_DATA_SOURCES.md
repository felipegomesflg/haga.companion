# Game Data Sources — Path of Exile 2

This document describes what game metadata exists today, where to obtain it, and how HAGA Overlay will use it.

---

## How we found RePoE

[RePoE](https://repoe-fork.github.io/) (Repository of Path of Exile resources) is a community project that exports datamined game files to JSON. It is maintained by tool developers and updated after game patches.

| Resource | URL |
|----------|-----|
| Project home | https://repoe-fork.github.io/ |
| PoE2 data index | https://repoe-fork.github.io/poe2/ |
| Source code | https://github.com/repoe-fork/repoe-fork |
| Data parser | [PyPoE](https://github.com/Project-Path-of-Exile-Wiki/PyPoE) + [dat-schema](https://github.com/poe-tool-dev/dat-schema) |

RePoE is **not official GGG data**. It is the standard source used by PoB, poedb, and other PoE tools.

---

## RePoE file catalog (PoE2)

### Gems & skills

| File | URL | Contents |
|------|-----|----------|
| **`skill_gems.json`** | https://repoe-fork.github.io/poe2/skill_gems.json | All gems: `active`, `support`, and `spirit` in a single file |
| **`gem_tags.json`** | https://repoe-fork.github.io/poe2/gem_tags.json | Tag id → display label (e.g. `"fire": "[Fire]"`) |
| **`active_skill_types.json`** | https://repoe-fork.github.io/poe2/active_skill_types.json | Skill classification list |
| **`cost_types.json`** | https://repoe-fork.github.io/poe2/cost_types.json | Mana, Life, ES, Rage cost formats |

> **Note:** The old filename `gems.json` no longer exists. Use `skill_gems.json`.

#### Verified `skill_gems.json` structure

```json
{
  "Metadata/Items/Gem/SkillGemAlchemistsBoon": {
    "base_item": {
      "display_name": "Alchemist's Boon",
      "id": "Metadata/Items/Gem/SkillGemAlchemistsBoon",
      "release_state": "released"
    },
    "gem_type": "active",
    "color": "g",
    "crafting_level": 14,
    "crafting_types": ["Bow"],
    "tags": ["dexterity", "grants_active_skill", "buff", "persistent", "aura"],
    "icon_dds_file": "Art/2DArt/SkillIcons/4k/AlchemistsBoonSkill.dds",
    "recommended_supports": ["Metadata/Items/Gems/SupportGemPrecision", "..."],
    "requirement_weights": { "dexterity": 100, "intelligence": 0, "strength": 0 }
  }
}
```

`gem_type` values found in file: **`active`**, **`support`**, **`spirit`**.

#### Gem counts (PoE2DB reference)

| Category | Approx. count |
|----------|---------------|
| Skill (active) | ~355 |
| Support | ~527 |
| Meta / Spirit | ~77 |
| **Total indexed** | **~881** |

---

### Items, mods & correlation (Equips tab)

These files enable **mod ↔ item correlation**: which prefixes/suffixes can roll on which base types.

| File | URL | Contents |
|------|-----|----------|
| **`uniques.json`** | https://repoe-fork.github.io/poe2/uniques.json | Unique names, item class, art path (~400+) |
| **`base_items.json`** | https://repoe-fork.github.io/poe2/base_items.json | All base item types: tags, class, properties, implicits |
| **`mods.json`** | https://repoe-fork.github.io/poe2/mods.json | All item mods: prefix/suffix, stats, spawn tags |
| **`item_classes.json`** | https://repoe-fork.github.io/poe2/item_classes.json | Item class id → category name |
| **`tags.json`** | https://repoe-fork.github.io/poe2/tags.json | Full list of item tags used in spawn rules |

> **Correction:** `tags.json` is separate from `item_classes.json`. Both are required.

#### Verified `mods.json` structure

```json
{
  "Strength1": {
    "domain": "item",
    "generation_type": "suffix",
    "name": "of the Brute",
    "required_level": 1,
    "groups": ["Strength"],
    "implicit_tags": ["attribute"],
    "spawn_weights": [
      { "tag": "ring", "weight": 1 },
      { "tag": "amulet", "weight": 1 },
      { "tag": "default", "weight": 0 }
    ],
    "stats": [{ "id": "additional_strength", "min": 5, "max": 8 }],
    "text": "+(5-8) to [Strength|Strength]"
  }
}
```

Key fields for mod correlation:

| Field | Purpose |
|-------|---------|
| `generation_type` | `prefix` or `suffix` — enforces 3+3 limit |
| `spawn_weights` | Which item tags this mod can roll on (`weight > 0`) |
| `groups` | Mod group — same group cannot repeat on one item |
| `text` | Human-readable mod line for overlay display |
| `required_level` | Filter by character level during leveling |

#### Verified `base_items.json` structure

```json
{
  "Metadata/Items/Armours/BodyArmours/BodyStr1": {
    "name": "Plate Vest",
    "item_class": "Body Armour",
    "tags": ["body_armour", "armour", "str_armour", "default"],
    "drop_level": 1,
    "implicits": [],
    "properties": { "armour": 50, "..." : "..." },
    "visual_identity": { "dds_file": "...", "id": "..." }
  }
}
```

#### Mod ↔ item correlation algorithm

```
1. User selects item (unique OR rare base)
2. Resolve item tags:
   - Rare  → base_items.tags
   - Unique → map item_class → equivalent tags (ring, amulet, helmet, etc.)
3. Query mods WHERE:
   - generation_type = 'prefix' | 'suffix'
   - EXISTS spawn_weight WHERE tag IN item_tags AND weight > 0
4. Present filtered mod list in editor
5. User picks up to 3 prefixes + 3 suffixes
6. Validate: no duplicate mod groups on same item
```

---

## Unique items

| Source | Count | Detail |
|--------|-------|--------|
| [PoE2 Wiki](https://www.poe2wiki.net/wiki/Unique_item) | ~406 | Includes modifier variants |
| RePoE `uniques.json` | ~400+ | Name, class, art |

Example names: Astramentis, Headhunter, Goldrim, Tabula Rasa, Whispering Ice.

RePoE `uniques.json` does **not** include fixed unique mod text. For uniques, HAGA lets the user attach **target mods** from the correlated mod pool (useful for planning rare gear until the unique drops) or free-text notes.

For full unique mod definitions (hand-maintained): [PoB Uniques export](https://repoe-fork.github.io/) — future enhancement.

---

## Campaign / Leveling Objectives (6 Acts)

| State | Structure |
|-------|-----------|
| Early Access (now) | 4 Acts + 3 Interludes |
| Full release (planned) | 6 Acts |

HAGA uses 6 act tabs from day one. Acts 5–6 show **"Coming soon"** until populated.

**Interludes are not tracked** — campaign scope is Acts 1–6 only.

Seed data sources:

| Source | Content |
|--------|---------|
| [Mobalytics Campaign Checklist](https://mobalytics.gg/poe-2/guides/0-5-campaign-checklist-stats-rewards-skillpoints-and-more) | Act rewards, gems, passives |
| [PoE Vault — Permanent Buffs](https://www.poe-vault.com/poe2/guides/campaign-difficulties-and-permanent-buffs) | Missable buffs |
| [Game8 Walkthrough](https://game8.co/games/Path-of-Exile-2/archives/486659) | Quest steps |

You will provide `campaign_objectives.json` — see [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md).

---

## Import pipeline

```
RePoE JSON (remote or bundled snapshots)
       │
       ├── skill_gems.json  ──► gems table
       ├── uniques.json     ──► unique_items table
       ├── base_items.json  ──► base_items table
       ├── mods.json        ──► mods + mod_spawn_tags tables
       ├── item_classes.json──► item_classes table
       ├── tags.json        ──► item_tags table
       ├── gem_tags.json    ──► gem_tags table (lookup)
       ├── cost_types.json  ──► (optional, future)
       │
       ▼
  scripts/seed-game-data.ts
       │
       ▼
  data/reference.db          ← bundled with app
       │
       ▼
  campaign_objectives.json   ← YOU provide
```

### Bundled seed snapshots

Store downloaded JSON in repo for offline/reproducible builds:

```
haga-overlay/data/runtime/
├── skill_gems.json
├── uniques.json
├── base_items.json
├── mods.json
├── item_classes.json
├── gem_tags.json
├── campaign_objectives.json   ← poe2-leveling.com export (acts + objectives)
├── active_skill_types.json    ← optional (not imported to DB yet)
├── cost_types.json            ← optional (not imported to DB yet)
└── reference.db               ← generated — run npm run seed:data
```

Regenerate after updating JSON files:

```bash
npm run seed:data
```

---

## Icon assets

RePoE uses `.dds` paths. Options:

1. **ggpk-exposed CDN:** `https://image.ggpk.exposed/poe2/{dds_path}?format=png`
2. Bundle subset of PNGs for common items/gems
3. Text-only in MVP v0.1 (fastest)

---

## Legal note

Game data belongs to **Grinding Gear Games**. HAGA is a fan companion tool. Use HAGA branding only in the distributed product.
