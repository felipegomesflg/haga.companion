export type BudgetTier = 'early' | 'medium' | 'high'
export type ItemRarity = 'unique' | 'rare'

export interface BuildProfile {
  id: string
  name: string
  className: string | null
  notes: string | null
  activeBudgetTier: BudgetTier
  isActive: boolean
  gameCharacterName: string | null
  trackedCharacterLevel: number | null
  createdAt: string
  updatedAt: string
}

export interface BuildGemLink {
  id: string
  gemId: string
  gemName: string
  gemType: string
  color: string | null
  craftingLevel: number | null
  tags: string[]
  isUnknown: boolean
  linkIndex: number
  notes: string | null
}

export interface RecommendedSupportGem {
  gemId: string
  gemName: string
  gemType: string
  color: string | null
}

export interface BuildEquipPage {
  id: string
  buildId: string
  title: string
  sortOrder: number
  isActive: boolean
}

export interface BuildGemPage {
  id: string
  buildId: string
  title: string
  sortOrder: number
  isActive: boolean
}

export interface BuildGemGroup {
  id: string
  buildId: string
  pageId: string
  sortOrder: number
  notes: string | null
  mainGem: BuildGemLink | null
  linkedGems: BuildGemLink[]
  recommendedSupports: RecommendedSupportGem[]
}

export interface BuildItemMod {
  id: string
  modId: string
  modText: string
  generationType: 'prefix' | 'suffix'
  slotIndex: number
}

export interface BuildItem {
  id: string
  buildId: string
  pageId: string
  /** @deprecated Legacy field — use equip pages instead */
  budgetTier?: BudgetTier
  rarity: ItemRarity
  uniqueId: string | null
  uniqueName: string | null
  baseItemId: string | null
  baseItemName: string | null
  slotLabel: string
  priority: number
  notes: string | null
  itemClass: string | null
  isTwoHanded: boolean
  iconDdsFile: string | null
  iconArtUrl: string | null
  mods: BuildItemMod[]
}

export interface PassiveTreeSlot {
  id: string
  buildId: string
  slotIndex: number
  levelLabel: string
  imageUrl: string | null
  notes: string | null
}

export interface CampaignObjective {
  id: string
  arcId: string
  actNumber: number
  sortOrder: number
  title: string
  description: string | null
  isOptional: boolean
  objectiveType: string | null
  rewardTags: string[] | null
  /** In-game zone name from Client.txt when explicitly mapped */
  expectedZoneName?: string | null
  isCompleted: boolean
}

export interface CampaignArc {
  id: string
  actNumber: number
  name: string
  tabLabel: string
  description: string | null
  sortOrder: number
  isAvailable: boolean
}

/** @deprecated Use CampaignArc */
export type CampaignAct = CampaignArc

import type { AppLocale } from './locale'

export interface AppSettings {
  locale: AppLocale
  hotkeyToggleBuildPanel: string
  hotkeyToggleCampaignPanel: string
  hotkeyToggleHud: string
  hotkeyToggleClickThrough: string
  hotkeyOpenSettings: string
  overlayHudAlwaysVisible: boolean
  overlayClickThroughDefault: boolean
  overlayOpacity: number
  campaignAutoDetectAct: boolean
  clientLogPath: string
}

export type AreaMatchType = 'exact' | 'partial' | 'unmapped'

export interface GameLocationState {
  status: 'idle' | 'watching' | 'missing_log'
  areaName: string | null
  areaInstanceId: string | null
  arcId: string | null
  actNumber: number | null
  arcTabLabel: string | null
  characterName: string | null
  characterLevel: number | null
  levelSource: 'level_up' | 'whois' | 'saved' | null
  lastLevelLine: string | null
  matchType: AreaMatchType | null
  matchedZoneName: string | null
  lastAreaLine: string | null
  captureSource: 'scene' | 'entered' | null
  logPath: string | null
  updatedAt: string | null
}

export interface GemUnlockAlert {
  gemId: string
  gemName: string
  gemType: string
  color: string | null
  requiredLevel: number
}

export interface HudState {
  objective: CampaignObjective | null
  expectedZoneName: string | null
}
