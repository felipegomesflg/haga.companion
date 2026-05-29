import { formatPoBItemNotes } from '../../src/lib/pobNotesFormat'
import { mapPoBSlotName } from '../../src/lib/pobSlots'
import type { SaveBuildItemInput, SaveEquipPageInput } from '../../src/types/ipc'
import { getReferenceDb } from '../db/referenceDb'
import { pobImportLog, pobImportSection, pobImportStructure, pobImportWarn } from './pobImportLog'

interface ParsedPoBItem {
  pobItemId: string
  rarity: 'unique' | 'rare' | 'other'
  name: string
  baseName: string
  implicitMods: string[]
  explicitMods: string[]
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

  const rarityRaw = lines[rarityLineIdx].replace(/^Rarity:\s*/i, '').toUpperCase()
  const rarity: ParsedPoBItem['rarity'] =
    rarityRaw === 'UNIQUE' ? 'unique' : rarityRaw === 'RARE' ? 'rare' : 'other'

  const name = decodeXmlEntities(lines[rarityLineIdx + 1] ?? '')
  const baseName = decodeXmlEntities(lines[rarityLineIdx + 2] ?? name)
  const modLines = lines.slice(rarityLineIdx + 3)
  const implicitMods: string[] = []
  const explicitMods: string[] = []
  let inExplicit = false

  for (const line of modLines) {
    if (/^Implicits:/i.test(line)) continue
    if (/^Prefix:/i.test(line) || /^Suffix:/i.test(line)) {
      inExplicit = true
      continue
    }
    if (inExplicit) explicitMods.push(stripPoBModTags(line))
    else implicitMods.push(stripPoBModTags(line))
  }

  return { pobItemId: '', rarity, name, baseName, implicitMods, explicitMods }
}

function parsePoBItems(xml: string): Map<string, ParsedPoBItem> {
  const items = new Map<string, ParsedPoBItem>()
  const itemRegex = /<Item id="(\d+)">\s*([\s\S]*?)<\/Item>/g
  let match: RegExpExecArray | null
  while ((match = itemRegex.exec(xml)) !== null) {
    const parsed = parsePoBItemBody(match[2])
    if (!parsed) continue
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

function slotsToItemInputs(
  slots: Array<{ pobSlotName: string; pobItemId: string }>,
  items: Map<string, ParsedPoBItem>,
): SaveBuildItemInput[] {
  const inputs: SaveBuildItemInput[] = []

  for (const slot of slots) {
    const hagaSlot = mapPoBSlotName(slot.pobSlotName)
    if (!hagaSlot) continue

    const pobItem = items.get(slot.pobItemId)
    if (!pobItem || pobItem.rarity === 'other') continue

    const notes = formatPoBItemNotes(pobItem.implicitMods, pobItem.explicitMods)

    if (pobItem.rarity === 'unique') {
      const uniqueId = resolveUniqueId(pobItem.name)
      if (!uniqueId) continue
      inputs.push({
        rarity: 'unique',
        uniqueId,
        baseItemId: null,
        slotLabel: hagaSlot,
        priority: 0,
        notes: notes || null,
        mods: [],
      })
      continue
    }

    const baseItemId = resolveBaseItemId(pobItem.baseName)
    if (!baseItemId) continue

    inputs.push({
      rarity: 'rare',
      uniqueId: null,
      baseItemId,
      slotLabel: hagaSlot,
      priority: 0,
      notes: notes || null,
      mods: [],
    })
  }

  return inputs
}

/** Parse every PoB ItemSet as a separate equipment page (Act 1, Final Version, …). */
export function parsePoBEquipPagesFromXml(xml: string): SaveEquipPageInput[] {
  pobImportSection('equip pages (multi-page)')

  const activeItemSetId = getActiveItemSetId(xml)
  pobImportLog('item set ativo no PoB', { activeItemSetId })

  const items = parsePoBItems(xml)
  const pages: SaveEquipPageInput[] = []
  const setRegex = /<ItemSet\b([^>]*)>([\s\S]*?)<\/ItemSet>/g
  let setMatch: RegExpExecArray | null

  while ((setMatch = setRegex.exec(xml)) !== null) {
    const attrs = setMatch[1]
    const itemSetId = attrs.match(/\bid="(\d+)"/)?.[1] ?? String(pages.length + 1)
    const titleRaw = attrs.match(/\btitle="([^"]*)"/)?.[1]
    const title = titleRaw ? decodeXmlEntities(titleRaw) : `Set ${itemSetId}`
    const slots = parseItemSetSlots(xml, itemSetId)
    const pageItems = slotsToItemInputs(slots, items)

    pobImportLog('item set parseado', {
      itemSetId,
      title,
      slotCount: slots.length,
      itemCount: pageItems.length,
    })

    pages.push({
      title,
      sortOrder: pages.length,
      isActive: itemSetId === activeItemSetId,
      items: pageItems,
    })
  }

  if (pages.length === 0) {
    pobImportWarn('nenhum ItemSet no XML', {
      activeItemSetId,
      itemSetIds: [...xml.matchAll(/<ItemSet\b[^>]*\bid="(\d+)"/g)].map((m) => m[1]),
    })
  } else if (!pages.some((p) => p.isActive)) {
    pages[0].isActive = true
    pobImportWarn('item set ativo sem itens — primeira página marcada como ativa', { activeItemSetId })
  }

  pobImportStructure('SaveEquipPageInput[] (páginas de equip PoB)', pages)

  return pages
}

/** @deprecated Returns items from the active ItemSet only. */
export function parsePoBItemInputsFromXmlLegacy(xml: string): SaveBuildItemInput[] {
  const pages = parsePoBEquipPagesFromXml(xml)
  const active = pages.find((p) => p.isActive) ?? pages[0]
  return active?.items ?? []
}
