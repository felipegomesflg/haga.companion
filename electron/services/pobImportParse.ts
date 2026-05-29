import type { SaveBuildItemInput, SaveEquipPageInput, SaveGemPageInput } from '../../src/types/ipc'
import { decodePoBShareCode } from './pobDecodeService'
import { parsePoBEquipPagesFromXml } from './pobEquipPagesImport'
import { pobImportLog, pobImportSection, pobImportStructure } from './pobImportLog'
import { parsePoBGemPagesFromXml } from './pobSkillImport'

export interface PoBParsedImport {
  equipPages: SaveEquipPageInput[]
  gemPages: SaveGemPageInput[]
}

export function parsePoBImportFromShareCode(shareCode: string): PoBParsedImport {
  pobImportSection('início do import PoB')

  const xml = decodePoBShareCode(shareCode)

  pobImportLog('XML decodificado', {
    length: xml.length,
    hasItems: xml.includes('<Items'),
    hasSkills: xml.includes('<Skills'),
    rootTag: xml.match(/<(\w+)/)?.[1] ?? null,
  })

  const equipPages = parsePoBEquipPagesFromXml(xml)
  const { pages: gemPages } = parsePoBGemPagesFromXml(xml)

  pobImportSection('resultado final para draft')

  pobImportStructure('payload PoB → HAGA', {
    equipPageCount: equipPages.length,
    equipItemCount: equipPages.reduce((n, p) => n + p.items.length, 0),
    gemPageCount: gemPages.length,
    gemGroupCount: gemPages.reduce((n, p) => n + p.gemGroups.length, 0),
    equipPages,
    gemPages,
  })

  return { equipPages, gemPages }
}
