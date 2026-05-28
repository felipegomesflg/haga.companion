import { inferPoBGemType, unknownGemId } from '../../src/lib/unknownGem'
import type { SaveGemGroupInput } from '../../src/types/ipc'
import { getReferenceDb } from '../db/referenceDb'
import { clearBuildGemGroups, saveBuildGemGroupPoB } from './buildService'
import { pobImportLog, pobImportSection, pobImportStructure, pobImportWarn } from './pobImportLog'

interface ParsedPoBGem {
  nameSpec: string
  gemIdPath: string
  skillId: string
  enabled: boolean
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

function parseSkillGroups(xml: string): ParsedPoBGem[][] {
  const setId = getActiveSkillSetId(xml)
  const setRegex = new RegExp(`<SkillSet\\b[^>]*\\bid="${setId}"[^>]*>[\\s\\S]*?<\\/SkillSet>`)
  const setMatch = xml.match(setRegex)
  if (!setMatch) {
    pobImportWarn('skill set ativo não encontrado', {
      activeSkillSetId: setId,
      skillSetsNoXml: [...xml.matchAll(/<SkillSet\b[^>]*\bid="(\d+)"/g)].map((match) => match[1]),
    })
    return []
  }

  const groups: ParsedPoBGem[][] = []
  const skillRegex = /<Skill\b([^>]*)>([\s\S]*?)<\/Skill>/g
  let skillMatch: RegExpExecArray | null

  while ((skillMatch = skillRegex.exec(setMatch[0])) !== null) {
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

export function parsePoBGemGroupInputsFromXml(xml: string): SaveGemGroupInput[] {
  pobImportSection('gems')

  const activeSkillSetId = getActiveSkillSetId(xml)
  pobImportLog('skill set ativo', { activeSkillSetId })

  const skillGroups = parseSkillGroups(xml)
  pobImportLog('grupos de skill parseados', {
    count: skillGroups.length,
    groups: skillGroups.map((gems, index) => ({
      index,
      gems: gems.map((gem) => ({
        nameSpec: gem.nameSpec,
        gemIdPath: gem.gemIdPath,
        skillId: gem.skillId,
      })),
    })),
  })

  const inputs = skillGroups.map((gems, groupIndex) => {
    const mainRaw = gems[0]
    const main = resolvePoBGem(mainRaw.nameSpec, mainRaw.gemIdPath, mainRaw.skillId, 'main')
    const linked = gems.slice(1, 6).map((gem) => {
      const resolved = resolvePoBGem(gem.nameSpec, gem.gemIdPath, gem.skillId, 'linked')
      return { gemId: resolved.gemId, notes: null as string | null, nameSpec: gem.nameSpec, gemType: resolved.gemType }
    })

    pobImportLog('grupo aceito', {
      groupIndex,
      main: { nameSpec: mainRaw.nameSpec, gemId: main.gemId, gemType: main.gemType },
      linked: linked.map((gem) => ({ nameSpec: gem.nameSpec, gemId: gem.gemId, gemType: gem.gemType })),
    })

    return {
      mainGemId: main.gemId,
      linkedGems: linked.map(({ gemId, notes }) => ({ gemId, notes })),
      notes: null,
    }
  })

  pobImportStructure('SaveGemGroupInput[] (gems para HAGA)', inputs)

  return inputs
}

export function importPoBSkillsFromXml(buildId: string, xml: string): void {
  const skillGroups = parseSkillGroups(xml)
  if (skillGroups.length === 0) return

  clearBuildGemGroups(buildId)

  skillGroups.forEach((gems, sortOrder) => {
    const mainRaw = gems[0]
    const main = resolvePoBGem(mainRaw.nameSpec, mainRaw.gemIdPath, mainRaw.skillId, 'main')

    const linkedGemIds = gems
      .slice(1, 6)
      .map((gem) => resolvePoBGem(gem.nameSpec, gem.gemIdPath, gem.skillId, 'linked').gemId)

    saveBuildGemGroupPoB(buildId, {
      sortOrder,
      mainGemId: main.gemId,
      linkedGemIds,
      notes: null,
    })
  })
}
