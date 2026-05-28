import type { BudgetTier } from '../../src/types/build'

import type { SaveBuildItemInput, SaveGemGroupInput } from '../../src/types/ipc'

import { decodePoBShareCode } from './pobDecodeService'

import { pobImportLog, pobImportSection, pobImportStructure } from './pobImportLog'

import { parsePoBItemInputsFromXml } from './pobItemImport'

import { parsePoBGemGroupInputsFromXml } from './pobSkillImport'



export interface PoBParsedImport {

  items: SaveBuildItemInput[]

  gemGroups: SaveGemGroupInput[]

}



export function parsePoBImportFromShareCode(shareCode: string, budgetTier: BudgetTier): PoBParsedImport {

  pobImportSection('início do import PoB')

  pobImportLog('budget tier alvo', { budgetTier })



  const xml = decodePoBShareCode(shareCode)

  pobImportLog('XML decodificado', {

    length: xml.length,

    hasItems: xml.includes('<Items'),

    hasSkills: xml.includes('<Skills'),

    rootTag: xml.match(/<(\w+)/)?.[1] ?? null,

  })



  const items = parsePoBItemInputsFromXml(xml, budgetTier)

  const gemGroups = parsePoBGemGroupInputsFromXml(xml)



  pobImportSection('resultado final para draft')

  pobImportStructure('payload PoB → HAGA', {
    itemCount: items.length,
    gemGroupCount: gemGroups.length,
    items,
    gemGroups,
  })



  return { items, gemGroups }

}


