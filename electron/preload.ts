import { contextBridge, ipcRenderer } from 'electron'
import type { HagaApi } from '../src/types/ipc'

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args) as Promise<T>

const api: HagaApi = {
  getHudState: () => invoke('haga:getHudState'),
  getHudLayoutMode: () => invoke('haga:getHudLayoutMode'),
  setHudLayoutMode: (mode, showFooter) => invoke('haga:setHudLayoutMode', mode, showFooter),
  toggleObjective: (objectiveId, completed) => invoke('haga:toggleObjective', objectiveId, completed),
  getCampaignArcs: () => invoke('haga:getCampaignArcs'),
  getCampaignActs: () => invoke('haga:getCampaignActs'),
  getCampaignObjectives: (arcId) => invoke('haga:getCampaignObjectives', arcId),
  getFirstIncompleteArcId: () => invoke('haga:getFirstIncompleteArcId'),
  getFirstIncompleteAct: () => invoke('haga:getFirstIncompleteAct'),
  getGameLocation: () => invoke('haga:getGameLocation'),
  getZonesForArc: (arcId) => invoke('haga:getZonesForArc', arcId),

  debugTriggerLevelUp: (targetLevel) => invoke('haga:debugTriggerLevelUp', targetLevel),
  resetCharacterLevel: () => invoke('haga:resetCharacterLevel'),
  getActiveBuild: () => invoke('haga:getActiveBuild'),
  getBuildGemPages: (buildId) => invoke('haga:getBuildGemPages', buildId),
  getBuildGemGroups: (buildId, pageId) => invoke('haga:getBuildGemGroups', buildId, pageId),
  setActiveGemPage: (buildId, pageId) => invoke('haga:setActiveGemPage', buildId, pageId),
  createBuildGemPage: (buildId, title) => invoke('haga:createBuildGemPage', buildId, title),
  renameBuildGemPage: (pageId, title) => invoke('haga:renameBuildGemPage', pageId, title),
  deleteBuildGemPage: (pageId) => invoke('haga:deleteBuildGemPage', pageId),
  getBuildEquipPages: (buildId) => invoke('haga:getBuildEquipPages', buildId),
  setActiveEquipPage: (buildId, pageId) => invoke('haga:setActiveEquipPage', buildId, pageId),
  createBuildEquipPage: (buildId, title) => invoke('haga:createBuildEquipPage', buildId, title),
  renameBuildEquipPage: (pageId, title) => invoke('haga:renameBuildEquipPage', pageId, title),
  deleteBuildEquipPage: (pageId) => invoke('haga:deleteBuildEquipPage', pageId),
  getBuildItems: (buildId, pageId) => invoke('haga:getBuildItems', buildId, pageId),
  getPassiveTrees: (buildId) => invoke('haga:getPassiveTrees', buildId),
  getSettings: () => invoke('haga:getSettings'),
  saveSettings: (settings) => invoke('haga:saveSettings', settings),
  exportShareCode: (buildId) => invoke('haga:exportShareCode', buildId),
  importShareCode: (code) => invoke('haga:importShareCode', code),
  decodePoBShareCode: (code) => invoke('haga:decodePoBShareCode', code),
  importPoBItems: (code) => invoke('haga:importPoBItems', code),
  searchGems: (query, gemTypes) => invoke('haga:searchGems', query, gemTypes),
  getGemDetails: (gemId) => invoke('haga:getGemDetails', gemId),
  searchUniques: (query, slotLabel) => invoke('haga:searchUniques', query, slotLabel),
  searchBaseItems: (query, slotLabel) => invoke('haga:searchBaseItems', query, slotLabel),
  searchMods: (query, tags, generationType, excludeModIds) =>
    invoke('haga:searchMods', query, tags, generationType, excludeModIds ?? []),
  saveBuildItem: (buildId, item) => invoke('haga:saveBuildItem', buildId, item),
  deleteBuildItem: (buildItemId) => invoke('haga:deleteBuildItem', buildItemId),
  savePassiveTreeSlot: (buildId, slot) => invoke('haga:savePassiveTreeSlot', buildId, slot),
  uploadPassiveTreeImage: (buildId, slotIndex, meta) =>
    invoke('haga:uploadPassiveTreeImage', buildId, slotIndex, meta),
  clearPassiveTreeImage: (buildId, slotIndex) => invoke('haga:clearPassiveTreeImage', buildId, slotIndex),
  deletePassiveTreeSlot: (buildId, slotIndex) => invoke('haga:deletePassiveTreeSlot', buildId, slotIndex),
  saveBuildGemGroup: (buildId, group) => invoke('haga:saveBuildGemGroup', buildId, group),
  deleteBuildGemGroup: (groupId) => invoke('haga:deleteBuildGemGroup', groupId),
  getBuildProfiles: () => invoke('haga:getBuildProfiles'),
  setActiveBuild: (buildId) => invoke('haga:setActiveBuild', buildId),
  setGameCharacterName: (buildId, name) => invoke('haga:setGameCharacterName', buildId, name),
  createBuild: (name, className) => invoke('haga:createBuild', name, className),
  renameBuild: (buildId, name) => invoke('haga:renameBuild', buildId, name),
  persistBuildDraft: (input) => invoke('haga:persistBuildDraft', input),
  previewBuildItem: (input) => invoke('haga:previewBuildItem', input),
  previewBuildGemGroup: (input, sortOrder) => invoke('haga:previewBuildGemGroup', input, sortOrder),
  parsePoBImport: (code) => invoke('haga:parsePoBImport', code),
  getItemTags: (rarity, uniqueId, baseItemId) =>
    invoke('haga:getItemTags', rarity, uniqueId ?? null, baseItemId ?? null),
  getItemTagsForSlot: (slotLabel) => invoke('haga:getItemTagsForSlot', slotLabel),
  getBuildPanelCollapsed: () => invoke('haga:getBuildPanelCollapsed'),
  getBuildPanelMaximized: () => invoke('haga:getBuildPanelMaximized'),
  getBuildPanelDockSide: () => invoke('haga:getBuildPanelDockSide'),
  expandBuildPanel: () => ipcRenderer.send('haga:expandBuildPanel'),
  toggleBuildPanelMaximized: () => ipcRenderer.send('haga:toggleBuildPanelMaximized'),
  toggleBuildPanelDockSide: () => ipcRenderer.send('haga:toggleBuildPanelDockSide'),
  closeWindow: () => ipcRenderer.send('haga:closeWindow'),
  closeOverlay: (kind) => ipcRenderer.send('haga:closeOverlay', kind),
  openDevLocationModal: () => ipcRenderer.send('haga:openDevLocationModal'),
  openDevLevelBox: () => ipcRenderer.send('haga:openDevLevelBox'),
  openCampaignPanel: () => ipcRenderer.send('haga:openCampaignPanel'),
  setWindowContentSize: (width, height) => ipcRenderer.send('haga:setWindowContentSize', width, height),
  openSettings: () => ipcRenderer.send('haga:openSettings'),
  openAbout: () => ipcRenderer.send('haga:openAbout'),
}

contextBridge.exposeInMainWorld('haga', api)

ipcRenderer.on('haga:hudUpdated', () => {
  window.dispatchEvent(new CustomEvent('haga:hudUpdated'))
})

ipcRenderer.on('haga:hudLayoutMode', (_event, mode: string) => {
  window.dispatchEvent(new CustomEvent('haga:hudLayoutMode', { detail: mode }))
})

ipcRenderer.on('haga:buildPanelCollapsed', (_event, collapsed: boolean) => {
  window.dispatchEvent(new CustomEvent('haga:buildPanelCollapsed', { detail: collapsed }))
})

ipcRenderer.on('haga:buildPanelMaximized', (_event, maximized: boolean) => {
  window.dispatchEvent(new CustomEvent('haga:buildPanelMaximized', { detail: maximized }))
})

ipcRenderer.on('haga:buildPanelDockSide', (_event, dockSide: 'left' | 'right') => {
  window.dispatchEvent(new CustomEvent('haga:buildPanelDockSide', { detail: dockSide }))
})

ipcRenderer.on('haga:gameLocationUpdated', () => {
  window.dispatchEvent(new CustomEvent('haga:gameLocationUpdated'))
})

ipcRenderer.on('haga:activeBuildUpdated', () => {
  window.dispatchEvent(new CustomEvent('haga:activeBuildUpdated'))
})

ipcRenderer.on('haga:gemUnlockAlert', (_event, alert) => {
  window.dispatchEvent(new CustomEvent('haga:gemUnlockAlert', { detail: alert }))
})

export {}
