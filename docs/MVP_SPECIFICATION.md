# MVP Specification — HAGA Overlay

**Product:** HAGA Overlay  
**Platform:** Windows desktop (Electron)  
**Target game:** Path of Exile 2 (Borderless Windowed recommended)  
**Language:** English (UI + code)  
**Developer:** FELGOM LTDA  
**Version target:** 0.1.0 (MVP)

---

## 1. Product summary

HAGA Overlay is a **campaign companion overlay** for Path of Exile 2. It helps players track their build and campaign progress without reading game memory. All data is user-edited or seeded from reference catalogs.

### Core value

1. See your **next campaign objective** at all times while playing
2. Open a **build reference panel** (gems, uniques, passive tree screenshots) via hotkey
3. Open a **campaign checklist panel** organized by act via a separate hotkey
4. Save, edit, and **share builds** via encrypted import/export codes

---

## 2. Window architecture

The app runs multiple Electron `BrowserWindow` instances:

| Window | Visibility | Position | Interaction |
|--------|------------|----------|-------------|
| **HUD — Next Objective** | Always on (default) | Top center | Checkbox: mark / unmark campaign objectives |
| **Build Panel** | Toggle via hotkey | Slides in from **right** | Read-only view; `[✎]` opens editor layer |
| **Build Editor Layer** | On demand | Over Build Panel (or replaces it) | Full editing; Cancel / Save |
| **Campaign Panel** | Toggle via hotkey | **Centered** on screen | Interactive when open |
| **Settings** | From tray menu | Normal centered window | Full interaction |
| **About** | From tray menu | Splash / modal | Read-only |

### Overlay window properties (HUD, Build Panel, Campaign Panel)

```typescript
{
  transparent: true,
  frame: false,
  alwaysOnTop: true,        // level: 'screen-saver'
  skipTaskbar: true,
  focusable: false,         // when click-through enabled
  resizable: false,         // HUD fixed; panels may resize
  hasShadow: false,
}
```

When a panel is open, `focusable: true` so the user can interact with tabs and checkboxes.

---

## 3. UI specifications

### 3.1 HUD — Next Objective (always visible)

```
┌─────────────────────────────────────────────────────────────┐
│  ▶ Act 2 · Defeat Kabala (+2 Passive Points)          [ ✓ ]  │
└─────────────────────────────────────────────────────────────┘
                    ↑ top center of primary monitor
```

**Behavior:**

- Shows the **first incomplete objective** across all acts (global order: Act 1 → Act 6)
- Clicking the checkbox **marks** the objective complete → HUD immediately shows the next one
- Clicking again **unmarks** (campaign objectives only) → that objective **returns to the HUD**
- Uncheck is also available in the Campaign Panel (same state, synced both ways)
- Does **not** require a hotkey to be visible (always on by default)
- Optional setting to hide HUD (tray → Settings)
- Semi-transparent dark background, high-contrast text

**Logic:**

```
nextObjective = first objective where is_completed = false
                ORDER BY act_number ASC, sort_order ASC
```

Includes `campaign_objectives` and `build_custom_objectives`.  
**Interludes are not tracked** — campaign scope is Acts 1–6 only.

---

### 3.2 Build Panel — slide from right

**Hotkey (default):** `Ctrl+Shift+B`  
**Configurable in:** Settings → Shortcuts

**Animation:** Panel slides in from the right edge (300ms ease-out). Same hotkey or `Esc` closes it.

**Layout:**

```
                                    ┌──────────────────────────┐
                                    │  Build: Cold Sorc Level  │
                                    ├──────────────────────────┤
                                    │ [Gems] [Equips] [Tree]   │
                                    ├──────────────────────────┤
                                    │                          │
                                    │   (tab content)          │
                                    │                          │
                                    └──────────────────────────┘
                                              ↑ right side, ~400px wide, full height
```

#### Tab: Gems

Displays the user's selected gems for the active build:

| Section | Content |
|---------|---------|
| Active Gems | Ordered list from `build_gems` where `slot_type = active` |
| Support Gems | Ordered list where `slot_type = support` |

Each row shows: gem name, type badge, optional note.  
Data comes from reference `gems` table (searchable catalog when editing — editor window, post-MVP or minimal inline).

#### Tab: Equips

Displays recommended gear from `build_items` — both **unique** and **rare** items.

**Budget tier combobox** (top of Equips tab):

| Tier | Label | Purpose |
|------|-------|---------|
| `early` | Early Budget | League start / leveling gear |
| `medium` | Medium Budget | Mid-campaign upgrades |
| `high` | High Budget | Endgame / bis targets |

Each **slot** (Helmet, Body, Weapon 1, Ring 2, etc.) has **one item config per tier** — up to 3 different setups. Switching the combobox swaps the visible item list without leaving the overlay.

```
┌─────────────────────────────────────────────┐
│  Budget: [ Early Budget        ▼ ]          │
├─────────────────────────────────────────────┤
│  [Helmet]  Goldrim                    [✎]  │
│  Prefix: +20 to maximum Life                │
│  Suffix: +12% to Fire Resistance            │
├─────────────────────────────────────────────┤
│  [Body]    Rare: Plate Vest           [✎]  │
│  Prefix: +(80-99) to maximum Life           │
│  Suffix: +25% to Lightning Resistance       │
└─────────────────────────────────────────────┘
                              [✎] = edit button, top-right aligned
```

| Column | Content |
|--------|---------|
| Slot | e.g. Helmet, Weapon 1, Ring 2 |
| Item name | Unique name OR "Rare: {base item name}" |
| Mods | Up to 3 prefixes + 3 suffixes (display `mods.text`) |
| Notes | User note (e.g. "Buy at level 12") |
| Edit `[✎]` | Opens mod editor (top-right of each row) |

**Item types:**

| Rarity | Reference | Mod editing |
|--------|-----------|---------------|
| `unique` | `unique_items` catalog | Optional target mods filtered by item class tags |
| `rare` | `base_items` catalog | Prefix/suffix picker filtered by base item tags |

### 3.2.1 Build Editor Layer

Opened via `[✎]` on any equip row, or an **Edit Build** action in the Build Panel header.

**Preferred:** a **child window layered on top** of the Build Panel overlay (same always-on-top stack, slightly larger, semi-opaque backdrop).

**Fallback** (if OS/Electron blocks stacked overlay focus): **replace** the Build Panel content with the editor view. Bottom bar shows **Cancel** (discard, restore previous panel) and **Save** (persist, return to read-only panel).

The editor includes:

- Item picker (unique / rare + base item search)
- Mod editor (prefixes / suffixes)
- Gem slots, tree image uploads, build notes
- Budget tier selector (edit Early / Medium / High independently)

```
┌──────────────────────────────────────────────┐
│  Edit Build — Early Budget · Helmet     [X]  │
├──────────────────────────────────────────────┤
│  PREFIXES (max 3)                            │
│  [1] +(80-99) to maximum Life          [−]   │
│  [2] — Add prefix...                   [+]   │
│                                              │
│  SUFFIXES (max 3)                            │
│  [1] +25% to Lightning Resistance      [−]   │
│                                              │
│         [ Cancel ]          [ Save ]         │
└──────────────────────────────────────────────┘
```

**Mod picker behavior:**

- Lists only mods valid for the item (via `mod_spawn_tags` ∩ item tags)
- Separated into Prefix / Suffix tabs in dropdown
- Search by mod text or name
- Prevents selecting mods from the same `mod_groups` twice
- Enforces max 3 prefixes and 3 suffixes
- Shows `required_level` badge for leveling guidance

**Data source:** RePoE [`mods.json`](https://repoe-fork.github.io/poe2/mods.json) correlated via [`base_items.json`](https://repoe-fork.github.io/poe2/base_items.json) tags and [`tags.json`](https://repoe-fork.github.io/poe2/tags.json).

#### Tab: Tree

Up to **4 passive tree references** per build — images hosted on [Imgur](https://imgur.com/upload).

| Slot | User-defined level | Content |
|------|-------------------|---------|
| 0 | e.g. "Level 10" | Imgur URL + optional notes |
| 1 | e.g. "Level 25" | Imgur URL + optional notes |
| 2 | e.g. "Level 45" | Imgur URL + optional notes |
| 3 | e.g. "Level 60" | Imgur URL + optional notes |

**Workflow:**

1. User uploads screenshot at https://imgur.com/upload
2. User copies the Imgur page URL (e.g. `https://imgur.com/abc123`)
3. User pastes URL in Build Editor → Tree slot
4. Overlay displays an **iframe** using Imgur embed URL (`https://imgur.com/{id}/embed`)

**URL normalization (app-side):**

| User pastes | Stored | Display iframe |
|-------------|--------|----------------|
| `https://imgur.com/abc123` | page URL | `https://imgur.com/abc123/embed` |
| `https://imgur.com/abc123/` | page URL | `https://imgur.com/abc123/embed` |
| `https://i.imgur.com/abc123.png` | direct URL | iframe or `<img>` via converted embed |

No local image files. Tree URLs are included in **HAGA share code** (small strings, no binary).

---

### 3.3 Campaign Panel — centered, tabbed by act

**Hotkey (default):** `Ctrl+Shift+C`  
**Separate from Build Panel hotkey** (as requested)

**Animation:** Fade + scale in at screen center (~600×500px)

**Layout:**

```
        ┌────────────────────────────────────────────────┐
        │  Campaign Progress                              │
        ├────────────────────────────────────────────────┤
        │ [Act 1] [Act 2] [Act 3] [Act 4] [Act 5] [Act 6]│
        ├────────────────────────────────────────────────┤
        │  [ ] Defeat Crowbell (+2 passives)             │
        │  [✓] Return Una's Lute (+2 passives)           │
        │  [ ] Defeat Candlemass (+20 Life)              │
        │  [ ] Optional: Freythorn Spirit upgrade        │
        └────────────────────────────────────────────────┘
```

**Behavior:**

- **6 tabs** — one per act
- On open: **auto-select the first act that has at least one unchecked objective**
- If Act 1 complete but Act 2 has pending items → open on **Act 2** tab
- Checking an item updates HUD immediately
- Optional objectives visually distinct (e.g. dashed border, "Optional" badge)
- **Acts 5–6:** tabs visible, content shows **"Coming soon"** until seed data is available
- **Interludes:** not included in campaign tracking

---

### 3.4 System tray

Icon in Windows notification area (uses `public/ico.ico`).

**Left click:** Toggle HUD visibility (optional) or no action  
**Right click menu:**

| Item | Action |
|------|--------|
| **Settings** | Opens Settings window |
| **About** | Opens About splash |
| **Exit** | Quits application |

No "minimize to tray only" confusion — app starts minimized to tray, overlay windows appear when game is detected (optional) or immediately.

---

### 3.5 Settings window

Accessible from tray → **Settings**.

**Sections:**

#### Shortcuts

| Setting | Default | Description |
|---------|---------|-------------|
| Toggle Build Panel | `Ctrl+Shift+B` | Slide-in build reference |
| Toggle Campaign Panel | `Ctrl+Shift+C` | Centered act checklist |
| Toggle Click-Through | `Ctrl+Shift+O` | Enable/disable mouse pass-through on HUD |
| Toggle HUD | `Ctrl+Shift+H` | Show/hide next objective bar |

- Click field → press new key combination to bind
- Reset to defaults button
- Stored in `app_settings` table

#### Overlay

| Setting | Default |
|---------|---------|
| HUD always visible | On |
| Click-through when panels closed | On |
| Overlay opacity | 90% |

#### Build

| Setting | Description |
|---------|-------------|
| Active build | Dropdown of saved build profiles |
| Import HAGA code | Paste share string → load build config (no images) |
| Export HAGA code | Copy lightweight share string to clipboard |
| Import / Export `.haga` bundle | Full backup including tree images (file picker) |

#### About (link)

Opens About splash.

---

### 3.6 About splash

```
┌─────────────────────────────────────┐
│         [ HAGA Logo ]               │
│                                     │
│         HAGA Overlay                │
│         Version 0.1.0               │
│                                     │
│   Developed by FELGOM LTDA          │
│                                     │
│              [ OK ]                 │
└─────────────────────────────────────┘
```

- Uses HAGA branding (not official PoE2 logo)
- Modal window, closes on OK or X

---

## 4. Import / Export

Two export formats — **do not embed tree images in the share code** (500 KB × 4 images → ~2.7 MB as Base64, too large for paste sharing).

### 4. Import / Export

### 4.1 HAGA Share Code (lightweight — pastebin style)

**Format:** `HAGA-{base64url-encoded-encrypted-payload}`

**Included:**

- Build name, class, notes
- Gems, items (all 3 budget tiers + mods)
- Passive tree **Imgur URLs** + level labels + notes (no binary)
- Objective progress + custom objectives

Typical share code size: **~5–50 KB**.

### 4.2 HAGA Bundle (optional `.haga` file)

ZIP backup of `build.json` only (no local tree files). Tree images live on Imgur and travel via URL in the share code.

---

## 5. Hotkeys summary

| Hotkey | Action | Panel type |
|--------|--------|------------|
| `Ctrl+Shift+B` | Toggle Build Panel | Right slide-in |
| `Ctrl+Shift+C` | Toggle Campaign Panel | Center modal |
| `Ctrl+Shift+H` | Toggle HUD | Top bar |
| `Ctrl+Shift+O` | Toggle click-through | Global |
| `Esc` | Close open panel | — |

All configurable in Settings.

---

## 6. Tech stack (confirmed)

| Layer | Choice |
|-------|--------|
| Runtime | Electron 30+ |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS 4 |
| State | Zustand |
| Storage | better-sqlite3 |
| Build | electron-builder → `.exe` |
| Bundler | Vite + vite-plugin-electron |

**Existing project:** `haga-overlay/` (scaffold ready, dependencies installed)

---

## 7. MVP scope

### In scope (v0.1.0)

- [ ] System tray (Settings, About, Exit)
- [ ] HUD — next objective bar (always visible)
- [ ] Build Panel — slide from right, 3 tabs (Gems, Equips, Tree)
- [ ] Campaign Panel — centered, 6 act tabs, auto-select incomplete act
- [ ] SQLite reference DB seeded from RePoE:
  - [ ] `skill_gems.json`, `uniques.json`, `base_items.json`, `mods.json`
  - [ ] `item_classes.json`, `tags.json`, `gem_tags.json`
- [ ] Equips tab — unique + rare items with mod editor (3 prefix / 3 suffix)
- [ ] Mod correlation — filter mods by item tags via `mod_spawn_tags`
- [ ] Campaign objectives seed structure (Acts 1–4 populated by you; 5–6 placeholder)
- [ ] Settings — hotkey configuration
- [ ] Basic build profile (create, set active, persist progress)
- [ ] Equips — 3 budget tiers (Early / Medium / High) per slot
- [ ] Build Editor Layer (overlay child window or replace-with Cancel/Save)
- [ ] Import/Export: HAGA share code (no images) + `.haga` bundle (with images)
- [ ] Passive tree — 4 image slots with level labels
- [ ] English UI and English codebase

### Out of scope (post-MVP)

- Interludes campaign tracking
- Item/gem icons (text-only list in MVP unless you provide assets)
- Fixed unique mod text from PoB export (uniques use optional target mods from correlated pool)
- Auto-detect PathOfExile.exe process
- DirectX DLL injection overlay
- Multiple monitor positioning UI
- Auto-update game data from network

---

## 8. Project structure (planned)

```
haga-overlay/
├── docs/                          ← this documentation
├── data/
│   ├── seeds/                     ← JSON seed files
│   └── reference.db               ← generated
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   ├── tray.ts
│   ├── hotkeys.ts
│   ├── windows/
│   │   ├── hudWindow.ts
│   │   ├── buildPanelWindow.ts
│   │   ├── campaignPanelWindow.ts
│   │   ├── settingsWindow.ts
│   │   └── aboutWindow.ts
│   ├── db/
│   │   ├── referenceDb.ts
│   │   ├── userDb.ts
│   │   └── migrations/
│   ├── services/
│   │   ├── buildService.ts
│   │   ├── objectiveService.ts
│   │   └── exportService.ts
│   └── ipc/
│       └── handlers.ts
├── scripts/
│   └── seed-game-data.ts          ← RePoE import script
├── src/
│   ├── windows/
│   │   ├── hud/
│   │   ├── build-panel/
│   │   ├── campaign-panel/
│   │   ├── settings/
│   │   └── about/
│   ├── components/
│   ├── stores/
│   └── types/
└── public/
    ├── ico.ico
    └── logo.png
```

---

## 9. Acceptance criteria (MVP done when)

1. App installs and runs from `.exe`, icon appears in system tray
2. HUD shows next unchecked objective; checking advances; unchecking returns it to HUD
3. `Ctrl+Shift+B` opens Build Panel from the right with Gems / Equips / Tree tabs
4. `Ctrl+Shift+C` opens Campaign Panel centered; lands on first act with pending items
5. Settings allows rebinding all hotkeys; changes persist after restart
6. About shows version and "Developed by FELGOM LTDA"
7. Share code export/import restores build config (items, mods, all budget tiers); tree images via `.haga` bundle or re-upload
8. Equips combobox switches Early / Medium / High budget item sets per slot
9. Reference DB contains gems, uniques, base items, and mods searchable by name
10. Edit button opens Build Editor Layer; user saves up to 3 prefixes and 3 suffixes per item
11. Mod picker only shows mods valid for the selected item's tags
12. Tree image upload rejects files > 500 KB (or auto-compresses to WebP)
13. All UI strings and code identifiers are in English

---

## 10. What we need from you before / during development

| Item | Owner | Status |
|------|-------|--------|
| Campaign objectives JSON (Acts 1–4) | You | Pending |
| Build-specific objective examples | You | Optional |
| Confirm 6-act tab design (placeholder for 5–6) | You | **Confirmed** |
| HAGA logo for About splash | You | `public/logo.png` exists |
| Confirm hotkey defaults | You | **Confirmed** |
| Approve MVP scope | You | **Go / No-go** |

---

## 11. Decisions (confirmed)

| # | Topic | Decision |
|---|-------|----------|
| 1 | Acts 5 & 6 | Tabs visible with **"Coming soon"** until populated |
| 2 | Interludes | **Not covered** — campaign is Acts 1–6 only |
| 3 | HUD checkbox | **Mark and unmark** campaign objectives; unchecking returns objective to HUD; synced with Campaign Panel |
| 4 | Tree images | **Imgur URLs** — upload at [imgur.com/upload](https://imgur.com/upload); overlay shows **iframe embed**; URLs included in share code |
| 5 | Build editing | **Editor layer** on top of Build Panel overlay; fallback: replace panel content with **Cancel / Save** |
| 6 | Item configs | **3 budget tiers** per slot: Early, Medium, High — combobox on Equips tab |

---

**Next step:** Reply with **go** to start MVP development.
