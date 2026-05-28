import type { AppLocale } from '../../src/types/locale'
import { getAppLocale } from '../services/localeService'

export interface ReferenceTableNames {
  gems: string
  gemTags: string
  uniqueItems: string
  itemClasses: string
  baseItems: string
  mods: string
  campaignArcs: string
  campaignObjectives: string
}

const EN_TABLES: ReferenceTableNames = {
  gems: 'gems',
  gemTags: 'gem_tags',
  uniqueItems: 'unique_items',
  itemClasses: 'item_classes',
  baseItems: 'base_items',
  mods: 'mods',
  campaignArcs: 'campaign_arcs',
  campaignObjectives: 'campaign_objectives',
}

const PT_TABLES: ReferenceTableNames = {
  gems: 'gems_pt',
  gemTags: 'gem_tags_pt',
  uniqueItems: 'unique_items_pt',
  itemClasses: 'item_classes_pt',
  baseItems: 'base_items_pt',
  mods: 'mods_pt',
  campaignArcs: 'campaign_arcs_pt',
  campaignObjectives: 'campaign_objectives_pt',
}

export function getReferenceTableNames(locale: AppLocale = getAppLocale()): ReferenceTableNames {
  return locale === 'pt-BR' ? PT_TABLES : EN_TABLES
}

export function localizedColumn(
  locale: AppLocale,
  enTable: string,
  ptTable: string,
  column: string,
  alias = column,
): string {
  if (locale === 'pt-BR') {
    return `COALESCE(${ptTable}.${column}, ${enTable}.${column}) AS ${alias}`
  }
  return `${enTable}.${column} AS ${alias}`
}
