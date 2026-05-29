import { formatPoBItemNotes } from '../../src/lib/pobNotesFormat'

import { mapPoBSlotName } from '../../src/lib/pobSlots'

import { getReferenceDb } from '../db/referenceDb'

import { decodePoBShareCode } from './pobDecodeService'

import { pobImportLog, pobImportSection, pobImportStructure, pobImportWarn } from './pobImportLog'

import { importPoBSkillsFromXml } from './pobSkillImport'

import { getActiveBuild, saveBuildEquipPagesPoB } from './buildService'
import { parsePoBEquipPagesFromXml } from './pobEquipPagesImport'

import type { BudgetTier } from '../../src/types/build'

import type { SaveBuildItemInput } from '../../src/types/ipc'



export interface PoBItemImportResult {

  imported: number

  skipped: Array<{ slot: string; reason: string }>

}



interface ParsedPoBItem {

  pobItemId: string

  rarity: 'unique' | 'rare' | 'other'

  name: string

  baseName: string

  implicitMods: string[]

  explicitMods: string[]

}



interface SkippedPoBItem {

  pobSlot: string

  pobItemId: string

  reason: string

  detail?: Record<string, unknown>

}



function decodeXmlEntities(value: string): string {

  return value

    .replace(/&apos;/g, "'")

    .replace(/&quot;/g, '"')

    .replace(/&lt;/g, '<')

    .replace(/&gt;/g, '>')

    .replace(/&amp;/g, '&')

}



function stripPoBModTags(line: string): string {

  return decodeXmlEntities(line.replace(/\{[^}]+\}/g, '').trim())

}



function stripCdata(raw: string): string {

  const match = raw.trim().match(/^<!\[CDATA\[([\s\S]*)\]\]>$/)

  return match ? match[1] : raw

}



function parsePoBItemBody(rawBody: string): ParsedPoBItem | null {

  const body = stripCdata(rawBody.replace(/\r/g, ''))

  const textPart = body.split('<ModRange')[0]?.trim() ?? body.trim()

  const lines = textPart

    .split('\n')

    .map((line) => line.trim())

    .filter(Boolean)



  if (lines.length < 2) return null



  const rarityLineIdx = lines.findIndex((line) => /^Rarity:\s*(UNIQUE|RARE|MAGIC|NORMAL)/i.test(line))

  if (rarityLineIdx < 0) return null



  const rarityMatch = lines[rarityLineIdx].match(/^Rarity:\s*(UNIQUE|RARE|MAGIC|NORMAL)/i)

  if (!rarityMatch) return null



  const rarityToken = rarityMatch[1].toUpperCase()

  const rarity = rarityToken === 'UNIQUE' ? 'unique' : rarityToken === 'RARE' ? 'rare' : 'other'

  const name = decodeXmlEntities(lines[rarityLineIdx + 1] ?? '')

  const baseName = decodeXmlEntities(lines[rarityLineIdx + 2] ?? name)



  const implicitsIdx = lines.findIndex((line) => /^Implicits:\s*\d+/i.test(line))

  const implicitCount =

    implicitsIdx >= 0 ? Number.parseInt(lines[implicitsIdx].replace(/^Implicits:\s*/i, ''), 10) : 0



  const modLines: string[] = []

  if (implicitsIdx >= 0) {

    for (let i = implicitsIdx + 1; i < lines.length; i++) {

      const line = lines[i]

      if (line.startsWith('<')) break

      modLines.push(stripPoBModTags(line))

    }

  }



  const implicitMods = modLines.slice(0, implicitCount).filter(Boolean)

  const explicitMods = modLines.slice(implicitCount).filter(Boolean)



  return {

    pobItemId: '',

    rarity,

    name,

    baseName,

    implicitMods,

    explicitMods,

  }

}



function parsePoBItems(xml: string): Map<string, ParsedPoBItem> {

  const items = new Map<string, ParsedPoBItem>()

  const itemRegex = /<Item\b[^>]*\bid="(\d+)"[^>]*>\s*([\s\S]*?)<\/Item>/g

  let match: RegExpExecArray | null

  while ((match = itemRegex.exec(xml)) !== null) {

    const parsed = parsePoBItemBody(match[2])

    if (!parsed) {

      pobImportWarn('corpo de item inválido', {

        pobItemId: match[1],

        preview: match[2].trim().slice(0, 160).replace(/\n/g, ' \\n '),

      })

      continue

    }

    parsed.pobItemId = match[1]

    items.set(match[1], parsed)

  }

  return items

}



function getActiveItemSetId(xml: string): string {
  return (
    xml.match(/<Items[^>]*\bactiveItemSet="(\d+)"/i)?.[1] ??
    xml.match(/\bactiveItemSet="(\d+)"/i)?.[1] ??
    '1'
  )
}

function listItemSetIds(xml: string): string[] {
  return [...xml.matchAll(/<ItemSet\b[^>]*\bid="(\d+)"/g)].map((match) => match[1])
}

/** PoB may emit Slot attributes in any order (e.g. itemId before name). */
function parseSlotAttributes(attrString: string): { pobSlotName: string; pobItemId: string } | null {
  const pobSlotName = attrString.match(/\bname="([^"]*)"/)?.[1]
  const pobItemId = attrString.match(/\bitemId="(\d+)"/)?.[1]
  if (!pobSlotName || !pobItemId || pobItemId === '0') return null
  return { pobSlotName, pobItemId }
}

function parseItemSetSlots(xml: string, setId: string): Array<{ pobSlotName: string; pobItemId: string }> {
  const setRegex = new RegExp(`<ItemSet\\b[^>]*\\bid="${setId}"[^>]*>[\\s\\S]*?<\\/ItemSet>`)
  const setMatch = xml.match(setRegex)
  if (!setMatch) return []

  const slots: Array<{ pobSlotName: string; pobItemId: string }> = []
  const slotRegex = /<Slot\b([^>]*)\/?>/g
  let match: RegExpExecArray | null
  while ((match = slotRegex.exec(setMatch[0])) !== null) {
    const parsed = parseSlotAttributes(match[1])
    if (parsed) slots.push(parsed)
  }
  return slots
}

function parseActiveItemSetSlots(xml: string): Array<{ pobSlotName: string; pobItemId: string }> {
  const setId = getActiveItemSetId(xml)
  let slots = parseItemSetSlots(xml, setId)

  if (slots.length === 0) {
    const itemSetIds = listItemSetIds(xml)
    pobImportWarn('item set ativo sem slots equipados — tentando fallback', {
      activeItemSetId: setId,
      itemSetIds,
    })
    for (const fallbackId of itemSetIds) {
      if (fallbackId === setId) continue
      slots = parseItemSetSlots(xml, fallbackId)
      if (slots.length > 0) {
        pobImportLog('usando item set fallback', { fallbackId, slotCount: slots.length })
        break
      }
    }
  }

  return slots
}



function resolveUniqueId(name: string): string | null {

  const ref = getReferenceDb()

  const row = ref.prepare('SELECT id FROM unique_items WHERE lower(name) = lower(?) LIMIT 1').get(name) as

    | { id: string }

    | undefined

  return row?.id ?? null

}



function resolveBaseItemId(name: string): string | null {

  const ref = getReferenceDb()

  const exact = ref.prepare('SELECT id FROM base_items WHERE lower(name) = lower(?) LIMIT 1').get(name) as

    | { id: string }

    | undefined

  if (exact) return exact.id



  const fuzzy = ref

    .prepare('SELECT id FROM base_items WHERE name LIKE ? ORDER BY length(name) LIMIT 1')

    .get(`%${name}%`) as { id: string } | undefined

  return fuzzy?.id ?? null

}



function summarizeItemInput(input: SaveBuildItemInput) {
  return {
    slotLabel: input.slotLabel,
    pageId: input.pageId,
    rarity: input.rarity,
    uniqueId: input.uniqueId,
    baseItemId: input.baseItemId,
    notesLines: input.notes?.split('\n').length ?? 0,
    mods: input.mods.length,
  }
}

export function parsePoBItemInputsFromXml(xml: string, _budgetTier?: BudgetTier): SaveBuildItemInput[] {
  const pages = parsePoBEquipPagesFromXml(xml)
  const active = pages.find((page) => page.isActive) ?? pages[0]
  return active?.items ?? []
}

export function importPoBItemsFromXml(buildId: string, xml: string, _budgetTier?: BudgetTier): PoBItemImportResult {
  const equipPages = parsePoBEquipPagesFromXml(xml)
  saveBuildEquipPagesPoB(buildId, equipPages)
  return {
    imported: equipPages.reduce((count, page) => count + page.items.length, 0),
    skipped: [],
  }
}

export function importPoBItemsFromShareCode(shareCode: string): PoBItemImportResult {
  const build = getActiveBuild()
  if (!build) throw new Error('No active build selected.')

  const xml = decodePoBShareCode(shareCode)
  const equipPages = parsePoBEquipPagesFromXml(xml)
  saveBuildEquipPagesPoB(build.id, equipPages)
  importPoBSkillsFromXml(build.id, xml)

  return {
    imported: equipPages.reduce((n, page) => n + page.items.length, 0),
    skipped: [],
  }
}


