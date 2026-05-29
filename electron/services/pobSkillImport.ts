import { inferPoBGemType, unknownGemId } from '../../src/lib/unknownGem'
import type { SaveGemGroupInput, SaveGemPageInput } from '../../src/types/ipc'
import { getReferenceDb } from '../db/referenceDb'
import { clearBuildGemPages, saveBuildGemPagesPoB } from './buildService'
import { pobImportLog, pobImportSection, pobImportStructure, pobImportWarn } from './pobImportLog'

interface ParsedPoBGem {
  nameSpec: string
  gemIdPath: string
  skillId: string
  enabled: boolean
}

export interface PoBGemPagesParseResult {
  pages: SaveGemPageInput[]
  activeSkillSetId: string
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function getActiveSkillSetId(xml: string): string {
  return xml.match(/<Skills[^>]*\bactiveSkillSet="(\d+)"/i)?.[1] ?? '1'
}

function parseGemTagAttributes(attrString: string): ParsedPoBGem | null {
  const nameSpec = attrString.match(/\bnameSpec="([^"]*)"/)?.[1]
  if (!nameSpec?.trim()) return null
  const enabledRaw = attrString.match(/\benabled="([^"]*)"/)?.[1] ?? 'true'
  return {
    nameSpec: decodeXmlEntities(nameSpec),
    gemIdPath: attrString.match(/\bgemId="([^"]*)"/)?.[1] ?? '',
    skillId: attrString.match(/\bskillId="([^"]*)"/)?.[1] ?? '',
    enabled: enabledRaw === 'true',
  }
}

function parseSkillGroupsFromSetXml(setXml: string): ParsedPoBGem[][] {
  const groups: ParsedPoBGem[][] = []
  const skillRegex = /<Skill\b([^>]*)>([\s\S]*?)<\/Skill>/g
  let skillMatch: RegExpExecArray | null

  while ((skillMatch = skillRegex.exec(setXml)) !== null) {
    const skillAttrs = skillMatch[1]
    const skillBody = skillMatch[2]
    const skillEnabled = (skillAttrs.match(/\benabled="([^"]*)"/)?.[1] ?? 'true') === 'true'
    if (!skillEnabled) continue

    const gems: ParsedPoBGem[] = []
    const gemRegex = /<Gem\b([^>]*)\/?>/g
    let gemMatch: RegExpExecArray | null
    while ((gemMatch = gemRegex.exec(skillBody)) !== null) {
      const parsed = parseGemTagAttributes(gemMatch[1])
      if (parsed?.enabled) gems.push(parsed)
    }

    if (gems.length > 0) groups.push(gems)
  }

  return groups
}

function normalizePoBGemId(gemIdPath: string): string[] {
  const trimmed = gemIdPath.trim()
  if (!trimmed) return []
  const candidates = new Set<string>([trimmed])
  candidates.add(trimmed.replace('/Items/Gems/', '/Items/Gem/'))
  candidates.add(trimmed.replace('/Items/Gem/', '/Items/Gems/'))
  return [...candidates]
}

function resolvePoBGem(
  nameSpec: string,
  gemIdPath: string,
  skillId: string,
  role: 'main' | 'linked',
): { gemId: string; gemType: string } {
  const ref = getReferenceDb()
  const normalizedName = nameSpec.trim()

  for (const candidateId of normalizePoBGemId(gemIdPath)) {
    const byId = ref
      .prepare('SELECT id, gem_type as gemType FROM gems WHERE id = ? LIMIT 1')
      .get(candidateId) as { id: string; gemType: string } | undefined
    if (byId) return { gemId: byId.id, gemType: byId.gemType }
  }

  if (gemIdPath) {
    const byIdSuffix = ref
      .prepare('SELECT id, gem_type as gemType FROM gems WHERE id LIKE ? ORDER BY length(id) LIMIT 1')
      .get(`%${gemIdPath.split('/').pop()}%`) as { id: string; gemType: string } | undefined
    if (byIdSuffix) return { gemId: byIdSuffix.id, gemType: byIdSuffix.gemType }
  }

  const byName = ref
    .prepare('SELECT id, gem_type as gemType FROM gems WHERE lower(name) = lower(?) LIMIT 1')
    .get(normalizedName) as { id: string; gemType: string } | undefined
  if (byName) return { gemId: byName.id, gemType: byName.gemType }

  const fuzzy = ref
    .prepare('SELECT id, gem_type as gemType FROM gems WHERE name LIKE ? ORDER BY length(name) LIMIT 1')
    .get(`%${normalizedName}%`) as { id: string; gemType: string } | undefined
  if (fuzzy) return { gemId: fuzzy.id, gemType: fuzzy.gemType }

  let gemType = inferPoBGemType(gemIdPath || skillId)
  if (role === 'main') {
    if (gemType === 'support') gemType = 'active'
  } else if (gemType !== 'support') {
    gemType = 'support'
  }

  return { gemId: unknownGemId(nameSpec, gemType), gemType }
}

function skillGroupsToInputs(skillGroups: ParsedPoBGem[][]): SaveGemGroupInput[] {
  return skillGroups.map((gems) => {
    const mainRaw = gems[0]
    const main = resolvePoBGem(mainRaw.nameSpec, mainRaw.gemIdPath, mainRaw.skillId, 'main')
    const linked = gems.slice(1, 6).map((gem) => {
      const resolved = resolvePoBGem(gem.nameSpec, gem.gemIdPath, gem.skillId, 'linked')
      return { gemId: resolved.gemId, notes: null as string | null }
    })
    return {
      mainGemId: main.gemId,
      linkedGems: linked,
      notes: null,
    }
  })
}

/** Parse every PoB SkillSet as a separate gem page (Act 1, Act 2, …). */
export function parsePoBGemPagesFromXml(xml: string): PoBGemPagesParseResult {
  pobImportSection('gems (multi-page)')

  const activeSkillSetId = getActiveSkillSetId(xml)
  pobImportLog('skill set ativo no PoB', { activeSkillSetId })

  const pages: SaveGemPageInput[] = []
  const setRegex = /<SkillSet\b([^>]*)>([\s\S]*?)<\/SkillSet>/g
  let setMatch: RegExpExecArray | null

  while ((setMatch = setRegex.exec(xml)) !== null) {
    const attrs = setMatch[1]
    const body = setMatch[2]
    const skillSetId = attrs.match(/\bid="(\d+)"/)?.[1] ?? String(pages.length + 1)
    const titleRaw = attrs.match(/\btitle="([^"]*)"/)?.[1]
    const title = titleRaw ? decodeXmlEntities(titleRaw) : `Set ${skillSetId}`
    const skillGroups = parseSkillGroupsFromSetXml(body)
    const gemGroups = skillGroupsToInputs(skillGroups)

    pobImportLog('skill set parseado', {
      skillSetId,
      title,
      groupCount: gemGroups.length,
    })

    pages.push({
      title,
      sortOrder: pages.length,
      isActive: skillSetId === activeSkillSetId,
      gemGroups,
    })
  }

  if (pages.length === 0) {
    pobImportWarn('nenhum SkillSet com gems no XML', {
      activeSkillSetId,
      skillSetIds: [...xml.matchAll(/<SkillSet\b[^>]*\bid="(\d+)"/g)].map((m) => m[1]),
    })
  } else if (!pages.some((p) => p.isActive)) {
    pages[0].isActive = true
    pobImportWarn('skill set ativo sem gems — primeira página marcada como ativa', { activeSkillSetId })
  }

  pobImportStructure('SaveGemPageInput[] (páginas de gems PoB)', pages)

  return { pages, activeSkillSetId }
}

/** @deprecated Use parsePoBGemPagesFromXml — returns groups from the active page only. */
export function parsePoBGemGroupInputsFromXml(xml: string): SaveGemGroupInput[] {
  const { pages } = parsePoBGemPagesFromXml(xml)
  const active = pages.find((p) => p.isActive) ?? pages[0]
  return active?.gemGroups ?? []
}

export function importPoBSkillsFromXml(buildId: string, xml: string): void {
  const { pages } = parsePoBGemPagesFromXml(xml)
  if (pages.length === 0) return
  clearBuildGemPages(buildId)
  saveBuildGemPagesPoB(buildId, pages)
}
