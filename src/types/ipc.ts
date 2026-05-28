import type {
  AppSettings,
  BuildGemGroup,
  BuildItem,
  BuildProfile,
  CampaignArc,
  CampaignObjective,
  GameLocationState,
  GemUnlockAlert,
  HudState,
  PassiveTreeSlot,
  BudgetTier,
  ItemRarity,
} from './build'

export interface SaveGemGroupInput {
  id?: string
  mainGemId: string
  linkedGems: Array<{ gemId: string; notes?: string | null }>
  notes?: string | null
}

export interface SaveBuildItemInput {
  id?: string
  budgetTier: BudgetTier
  rarity: ItemRarity
  uniqueId?: string | null
  baseItemId?: string | null
  slotLabel: string
  priority: number
  notes?: string | null
  mods: Array<{
    modId: string
    generationType: 'prefix' | 'suffix'
    slotIndex: number
  }>
}

export interface SaveTreeSlotInput {
  slotIndex: number
  levelLabel: string
  notes?: string | null
}

export interface UploadPassiveTreeImageInput {
  levelLabel: string
  notes?: string | null
}

export interface PersistBuildDraftInput {
  buildId: string | null
  name: string
  budgetTier: BudgetTier
  gemGroups: SaveGemGroupInput[]
  items: SaveBuildItemInput[]
  trees: SaveTreeSlotInput[]
}

export interface HagaApi {
  getHudState: () => Promise<HudState>
  getHudLayoutMode: () => Promise<'compact' | 'expanded' | 'maximized'>
  setHudLayoutMode: (
    mode: 'compact' | 'expanded' | 'maximized',
    showFooter?: boolean,
  ) => Promise<'compact' | 'expanded' | 'maximized'>
  toggleObjective: (objectiveId: string, completed: boolean) => Promise<HudState>
  getCampaignArcs: () => Promise<CampaignArc[]>
  getCampaignActs: () => Promise<CampaignArc[]>
  getCampaignObjectives: (arcId: string) => Promise<CampaignObjective[]>
  getFirstIncompleteArcId: () => Promise<string>
  getFirstIncompleteAct: () => Promise<number>
  getGameLocation: () => Promise<GameLocationState>
  getZonesForArc: (arcId: string) => Promise<string[]>
  debugTriggerLevelUp: (targetLevel: number) => Promise<GemUnlockAlert[]>
  resetCharacterLevel: () => Promise<GameLocationState>
  getActiveBuild: () => Promise<BuildProfile | null>
  getBuildGemGroups: (buildId: string) => Promise<BuildGemGroup[]>
  getBuildItems: (buildId: string, budgetTier: BudgetTier) => Promise<BuildItem[]>
  getPassiveTrees: (buildId: string) => Promise<PassiveTreeSlot[]>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>
  exportShareCode: (buildId: string) => Promise<string>
  importShareCode: (code: string) => Promise<BuildProfile>
  decodePoBShareCode: (code: string) => Promise<string>
  importPoBItems: (code: string) => Promise<{ imported: number; skipped: Array<{ slot: string; reason: string }> }>
  searchGems: (query: string, gemTypes?: string[]) => Promise<
    Array<{ id: string; name: string; gemType: string; color: string | null }>
  >
  getGemDetails: (gemId: string) => Promise<{
    id: string
    name: string
    gemType: string
    color: string | null
    craftingLevel: number | null
    tags: string[]
    recommendedSupports: import('./build').RecommendedSupportGem[]
  } | null>
  searchUniques: (query: string, slotLabel?: string) => Promise<
    Array<{ id: string; name: string; itemClass: string; iconDdsFile: string | null }>
  >
  searchBaseItems: (query: string, slotLabel?: string) => Promise<
    Array<{ id: string; name: string; itemClass: string; iconDdsFile: string | null }>
  >
  searchMods: (
    query: string,
    tags: string[],
    generationType: 'prefix' | 'suffix',
    excludeModIds?: string[],
  ) => Promise<Array<{ id: string; text: string; requiredLevel: number | null }>>
  saveBuildItem: (buildId: string, item: SaveBuildItemInput) => Promise<BuildItem>
  deleteBuildItem: (buildItemId: string) => Promise<void>
  savePassiveTreeSlot: (buildId: string, slot: SaveTreeSlotInput) => Promise<PassiveTreeSlot>
  uploadPassiveTreeImage: (
    buildId: string,
    slotIndex: number,
    meta: UploadPassiveTreeImageInput,
  ) => Promise<PassiveTreeSlot | null>
  clearPassiveTreeImage: (buildId: string, slotIndex: number) => Promise<PassiveTreeSlot | null>
  deletePassiveTreeSlot: (buildId: string, slotIndex: number) => Promise<void>
  saveBuildGemGroup: (buildId: string, group: SaveGemGroupInput) => Promise<BuildGemGroup>
  deleteBuildGemGroup: (groupId: string) => Promise<void>
  getBuildProfiles: () => Promise<BuildProfile[]>
  setActiveBuild: (buildId: string) => Promise<void>
  setGameCharacterName: (
    buildId: string,
    name: string,
  ) => Promise<{ buildId: string; gameCharacterName: string | null; trackedCharacterLevel: number | null }>
  createBuild: (name: string, className?: string) => Promise<BuildProfile>
  renameBuild: (buildId: string, name: string) => Promise<BuildProfile>
  persistBuildDraft: (input: PersistBuildDraftInput) => Promise<BuildProfile>
  previewBuildItem: (input: SaveBuildItemInput) => Promise<BuildItem>
  previewBuildGemGroup: (input: SaveGemGroupInput, sortOrder?: number) => Promise<BuildGemGroup>
  parsePoBImport: (code: string, budgetTier: BudgetTier) => Promise<{ items: SaveBuildItemInput[]; gemGroups: SaveGemGroupInput[] }>
  getItemTags: (rarity: ItemRarity, uniqueId?: string | null, baseItemId?: string | null) => Promise<string[]>
  getItemTagsForSlot: (slotLabel: string) => Promise<string[]>
  getBuildPanelCollapsed: () => Promise<boolean>
  getBuildPanelMaximized: () => Promise<boolean>
  getBuildPanelDockSide: () => Promise<'left' | 'right'>
  expandBuildPanel: () => void
  toggleBuildPanelMaximized: () => void
  toggleBuildPanelDockSide: () => void
  closeWindow: () => void
  closeOverlay: (
    kind: 'hud' | 'build-panel' | 'campaign-panel' | 'dev-location-modal' | 'dev-level-box',
  ) => void
  openDevLocationModal: () => void
  openDevLevelBox: () => void
  openCampaignPanel: () => void
  setWindowContentSize: (width: number, height: number) => void
  openSettings: () => void
  openAbout: () => void
}

declare global {
  interface Window {
    haga: HagaApi
  }
}

export {}
