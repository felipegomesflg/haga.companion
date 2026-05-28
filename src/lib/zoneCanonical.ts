import aliasesFile from '../../data/runtime/zone_locale_aliases.json'

type ZoneLocaleFile = {
  aliases: Record<string, string>
  enToPt: Record<string, string>
}

const data = aliasesFile as ZoneLocaleFile

export function normalizeZoneName(name: string): string {
  return name.trim().toLowerCase()
}

/** Resolve any EN/PT in-game area name to canonical EN (zone_arc_map). */
export function canonicalZoneName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return trimmed
  return data.aliases[normalizeZoneName(trimmed)] ?? trimmed
}

/** PT-BR label for HUD when locale is pt-BR. */
export function localizeZoneName(enName: string, locale: string): string {
  if (locale !== 'pt-BR') return enName
  return data.enToPt[enName] ?? enName
}

export function getZoneLocaleAliases(): Readonly<Record<string, string>> {
  return data.aliases
}
