/** RePoE PoE2 static host — https://repoe-fork.github.io/poe2/ */
export const REPOE_POE2_BASE_URL = 'https://repoe-fork.github.io/poe2'

/** Same art path via ggpk-exposed (PNG) when gh-pages does not serve the binary .dds */
const GGPK_EXPOSED_POE2_BASE_URL = 'https://image.ggpk.exposed/poe2'

function normalizeArtPath(iconDdsFile: string): string {
  return iconDdsFile.trim().replace(/^\/+/, '').replace(/\\/g, '/')
}

/** Canonical art URL on RePoE (path from `visual_identity.dds_file` / `icon_dds_file`). */
export function buildRePoEArtUrl(iconDdsFile: string | null | undefined): string | null {
  if (!iconDdsFile?.trim()) return null
  return `${REPOE_POE2_BASE_URL}/${normalizeArtPath(iconDdsFile)}`
}

/** Browser-friendly PNG for the same RePoE art path (for `<img>` in Chromium). */
export function buildRePoEItemIconDisplayUrl(iconDdsFile: string | null | undefined): string | null {
  if (!iconDdsFile?.trim()) return null
  const path = normalizeArtPath(iconDdsFile)
  return `${GGPK_EXPOSED_POE2_BASE_URL}/${path}?format=png`
}
