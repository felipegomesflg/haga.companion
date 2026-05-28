# HAGA Overlay — Documentation

Documentation for the **HAGA Overlay** desktop companion app for Path of Exile 2.

| Document | Description |
|----------|-------------|
| [MVP Specification](./MVP_SPECIFICATION.md) | Full product spec, UI behavior, hotkeys, equips mod editor, acceptance criteria |
| [Database Schema](./DATABASE_SCHEMA.md) | SQLite tables — gems, items, mods correlation, build item mods |
| [Game Data Sources](./GAME_DATA_SOURCES.md) | RePoE URLs, item/mod correlation, seed pipeline |

## Status

**Development in progress** (MVP v0.1.0).

## Brand assets

| File | Path | Usage |
|------|------|-------|
| App icon | `public/ico.ico` | System tray, window icon, Windows `.exe` |
| Splash logo | `public/logo.png` | About screen (FELGOM LTDA) |

Both are served by Vite from `/public` in dev and copied to `/dist` on build.

- **App UI:** English only
- **Code:** English only (variables, methods, comments, file names)

## Developer

FELGOM LTDA
