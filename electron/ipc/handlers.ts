import { BrowserWindow, dialog, ipcMain, screen } from 'electron'
import { getSetting, setSetting, getUserDb } from '../db/userDb'
import * as objectiveService from '../services/objectiveService'
import { getZonesForArc } from '../lib/zoneArcMap'
import { getGameLocationState, refreshClientLogTracker, reloadCharacterLevelFromBuild, resetCharacterLevelFromLog } from '../services/clientLogService'
import { focusPoeGameWindow } from '../services/gameWindowService'
import { setGameCharacterName } from '../services/characterLevelService'
import { debugTriggerLevelUp } from '../services/gemUnlockService'
import * as buildService from '../services/buildService'
import { decodePoBShareCode } from '../services/pobDecodeService'
import { importPoBItemsFromShareCode } from '../services/pobItemImport'
import { parsePoBImportFromShareCode } from '../services/pobImportParse'
import { exportShareCode, importShareCode } from '../services/exportService'
import type { AppSettings } from '../../src/types/build'
import { DEFAULT_LOCALE, normalizeLocale } from '../../src/types/locale'
import type { SaveBuildItemInput, SaveGemGroupInput, SaveTreeSlotInput, UploadPassiveTreeImageInput } from '../../src/types/ipc'
import {
  blurGameOverlayWindows,
  hideOverlayWindow,
  collapseBuildPanel,
  expandBuildPanel,
  getBuildPanelDockSide,
  getHudLayoutMode,
  isBuildPanelCollapsed,
  isBuildPanelMaximized,
  openDevLocationModal,
  openDevLevelBox,
  setHudLayoutMode,
  showOverlayWindow,
  toggleBuildPanelDockSide,
  toggleBuildPanelMaximized,
  type HudLayoutMode,
} from '../windows/overlayWindows'

let windowRefs: {
  openSettings?: () => void
  openAbout?: () => void
  broadcastHudUpdate?: () => void
  broadcastGameLocationUpdate?: () => void
  broadcastActiveBuildUpdate?: () => void
  broadcastLocaleUpdate?: () => void
} = {}

export function setWindowRefs(refs: typeof windowRefs): void {
  windowRefs = refs
}

function loadSettings(): AppSettings {
  const db = getUserDb()
  return {
    locale: normalizeLocale(getSetting(db, 'locale') || DEFAULT_LOCALE),
    hotkeyToggleBuildPanel: getSetting(db, 'hotkeyToggleBuildPanel'),
    hotkeyToggleCampaignPanel: getSetting(db, 'hotkeyToggleCampaignPanel'),
    hotkeyToggleHud: getSetting(db, 'hotkeyToggleHud'),
    hotkeyToggleClickThrough: getSetting(db, 'hotkeyToggleClickThrough'),
    hotkeyOpenSettings: getSetting(db, 'hotkeyOpenSettings'),
    overlayHudAlwaysVisible: getSetting(db, 'overlayHudAlwaysVisible') === 'true',
    overlayClickThroughDefault: getSetting(db, 'overlayClickThroughDefault') === 'true',
    overlayOpacity: Number(getSetting(db, 'overlayOpacity') || '0.9'),
    campaignAutoDetectAct: getSetting(db, 'campaignAutoDetectAct') !== 'false',
    clientLogPath: getSetting(db, 'clientLogPath') || '',
  }
}

export function registerIpcHandlers(): void {
  ipcMain.handle('haga:getHudState', () => objectiveService.getHudState())

  ipcMain.handle('haga:toggleObjective', async (event, objectiveId: string, completed: boolean) => {
    const state = objectiveService.toggleObjective(objectiveId, completed)
    windowRefs.broadcastHudUpdate?.()
    const sender = BrowserWindow.fromWebContents(event.sender)
    blurGameOverlayWindows(sender ?? undefined)
    await focusPoeGameWindow()
    return state
  })

  ipcMain.handle('haga:getCampaignArcs', () => objectiveService.getCampaignArcs())

  ipcMain.handle('haga:getCampaignActs', () => objectiveService.getCampaignActs())

  ipcMain.handle('haga:getCampaignObjectives', (_e, arcId: string) =>
    objectiveService.getCampaignObjectives(arcId),
  )

  ipcMain.handle('haga:getFirstIncompleteArcId', () => objectiveService.getFirstIncompleteArcId())

  ipcMain.handle('haga:getFirstIncompleteAct', () => objectiveService.getFirstIncompleteAct())

  ipcMain.handle('haga:getGameLocation', () => getGameLocationState())

  ipcMain.handle('haga:getZonesForArc', (_e, arcId: string) => getZonesForArc(arcId))


  ipcMain.handle('haga:debugTriggerLevelUp', (_e, targetLevel: number) => {
    return debugTriggerLevelUp(targetLevel)
  })

  ipcMain.handle('haga:resetCharacterLevel', () => {
    const state = resetCharacterLevelFromLog()
    windowRefs.broadcastGameLocationUpdate?.()
    return state
  })

  ipcMain.handle('haga:getActiveBuild', () => buildService.getActiveBuild())
  ipcMain.handle('haga:getBuildProfiles', () => buildService.getBuildProfiles())
  ipcMain.handle('haga:setActiveBuild', (_e, buildId: string) => {
    buildService.setActiveBuild(buildId)
    reloadCharacterLevelFromBuild()
    windowRefs.broadcastGameLocationUpdate?.()
    windowRefs.broadcastActiveBuildUpdate?.()
  })
  ipcMain.handle('haga:setGameCharacterName', (_e, buildId: string, name: string) => {
    const tracking = setGameCharacterName(buildId, name)
    reloadCharacterLevelFromBuild()
    windowRefs.broadcastGameLocationUpdate?.()
    return tracking
  })
  ipcMain.handle('haga:createBuild', (_e, name: string, className?: string) => buildService.createBuild(name, className))
  ipcMain.handle('haga:renameBuild', (_e, buildId: string, name: string) => buildService.renameBuild(buildId, name))
  ipcMain.handle('haga:persistBuildDraft', (_e, input) => {
    const profile = buildService.persistBuildDraft(input)
    reloadCharacterLevelFromBuild()
    windowRefs.broadcastGameLocationUpdate?.()
    windowRefs.broadcastActiveBuildUpdate?.()
    return profile
  })
  ipcMain.handle('haga:previewBuildItem', (_e, input) => buildService.previewBuildItem(input))
  ipcMain.handle('haga:previewBuildGemGroup', (_e, input, sortOrder?: number) =>
    buildService.previewBuildGemGroup(input, sortOrder ?? 0),
  )
  ipcMain.handle('haga:parsePoBImport', (_e, code: string) => parsePoBImportFromShareCode(code))

  ipcMain.handle('haga:getBuildGemPages', (_e, buildId: string) => buildService.getBuildGemPages(buildId))
  ipcMain.handle('haga:getBuildGemGroups', (_e, buildId: string, pageId?: string) =>
    buildService.getBuildGemGroups(buildId, pageId),
  )
  ipcMain.handle('haga:setActiveGemPage', (_e, buildId: string, pageId: string) =>
    buildService.setActiveGemPage(buildId, pageId),
  )
  ipcMain.handle('haga:createBuildGemPage', (_e, buildId: string, title: string) =>
    buildService.createBuildGemPage(buildId, title),
  )
  ipcMain.handle('haga:renameBuildGemPage', (_e, pageId: string, title: string) =>
    buildService.renameBuildGemPage(pageId, title),
  )
  ipcMain.handle('haga:deleteBuildGemPage', (_e, pageId: string) => buildService.deleteBuildGemPage(pageId))
  ipcMain.handle('haga:getBuildEquipPages', (_e, buildId: string) => buildService.getBuildEquipPages(buildId))
  ipcMain.handle('haga:setActiveEquipPage', (_e, buildId: string, pageId: string) =>
    buildService.setActiveEquipPage(buildId, pageId),
  )
  ipcMain.handle('haga:createBuildEquipPage', (_e, buildId: string, title: string) =>
    buildService.createBuildEquipPage(buildId, title),
  )
  ipcMain.handle('haga:renameBuildEquipPage', (_e, pageId: string, title: string) =>
    buildService.renameBuildEquipPage(pageId, title),
  )
  ipcMain.handle('haga:deleteBuildEquipPage', (_e, pageId: string) => buildService.deleteBuildEquipPage(pageId))
  ipcMain.handle('haga:getBuildItems', (_e, buildId: string, pageId?: string) =>
    buildService.getBuildItems(buildId, pageId),
  )
  ipcMain.handle('haga:getPassiveTrees', (_e, buildId: string) => buildService.getPassiveTrees(buildId))

  ipcMain.handle('haga:getSettings', () => loadSettings())
  ipcMain.handle('haga:saveSettings', (_e, partial: Partial<AppSettings>) => {
    const db = getUserDb()
    if (partial.hotkeyToggleBuildPanel) setSetting(db, 'hotkeyToggleBuildPanel', partial.hotkeyToggleBuildPanel)
    if (partial.hotkeyToggleCampaignPanel) setSetting(db, 'hotkeyToggleCampaignPanel', partial.hotkeyToggleCampaignPanel)
    if (partial.hotkeyToggleHud) setSetting(db, 'hotkeyToggleHud', partial.hotkeyToggleHud)
    if (partial.hotkeyToggleClickThrough) setSetting(db, 'hotkeyToggleClickThrough', partial.hotkeyToggleClickThrough)
    if (partial.hotkeyOpenSettings) setSetting(db, 'hotkeyOpenSettings', partial.hotkeyOpenSettings)
    if (partial.overlayHudAlwaysVisible !== undefined)
      setSetting(db, 'overlayHudAlwaysVisible', String(partial.overlayHudAlwaysVisible))
    if (partial.overlayClickThroughDefault !== undefined)
      setSetting(db, 'overlayClickThroughDefault', String(partial.overlayClickThroughDefault))
    if (partial.overlayOpacity !== undefined) setSetting(db, 'overlayOpacity', String(partial.overlayOpacity))
    if (partial.campaignAutoDetectAct !== undefined) {
      setSetting(db, 'campaignAutoDetectAct', String(partial.campaignAutoDetectAct))
      refreshClientLogTracker()
      windowRefs.broadcastGameLocationUpdate?.()
    }
    if (partial.clientLogPath !== undefined) {
      setSetting(db, 'clientLogPath', partial.clientLogPath.trim())
      refreshClientLogTracker()
      windowRefs.broadcastGameLocationUpdate?.()
    }
    if (partial.locale !== undefined) {
      setSetting(db, 'locale', partial.locale)
      windowRefs.broadcastLocaleUpdate?.()
      windowRefs.broadcastHudUpdate?.()
      windowRefs.broadcastGameLocationUpdate?.()
    }
    return loadSettings()
  })

  ipcMain.handle('haga:exportShareCode', (_e, buildId: string) => exportShareCode(buildId))
  ipcMain.handle('haga:importShareCode', (_e, code: string) => importShareCode(code))

  ipcMain.handle('haga:searchGems', (_e, query: string, gemTypes?: string[]) => buildService.searchGems(query, gemTypes))
  ipcMain.handle('haga:getGemDetails', (_e, gemId: string) => buildService.getGemDetails(gemId))
  ipcMain.handle('haga:searchUniques', (_e, query: string, slotLabel?: string) =>
    buildService.searchUniques(query, slotLabel),
  )
  ipcMain.handle('haga:searchBaseItems', (_e, query: string, slotLabel?: string) =>
    buildService.searchBaseItems(query, slotLabel),
  )
  ipcMain.handle(
    'haga:searchMods',
    (_e, query: string, tags: string[], generationType: string, excludeModIds?: string[]) =>
      buildService.searchMods(query, tags, generationType as 'prefix' | 'suffix', excludeModIds ?? []),
  )

  ipcMain.handle('haga:saveBuildItem', (_e, buildId: string, item: SaveBuildItemInput) =>
    buildService.saveBuildItem(buildId, item),
  )
  ipcMain.handle('haga:deleteBuildItem', (_e, buildItemId: string) => buildService.deleteBuildItem(buildItemId))
  ipcMain.handle('haga:savePassiveTreeSlot', (_e, buildId: string, slot: SaveTreeSlotInput) =>
    buildService.savePassiveTreeSlot(buildId, slot),
  )
  ipcMain.handle(
    'haga:uploadPassiveTreeImage',
    async (event, buildId: string, slotIndex: number, meta: UploadPassiveTreeImageInput) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const dialogOptions: Electron.OpenDialogOptions = {
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
      }
      const { canceled, filePaths } = win
        ? await dialog.showOpenDialog(win, dialogOptions)
        : await dialog.showOpenDialog(dialogOptions)
      if (canceled || !filePaths[0]) return null
      return buildService.uploadPassiveTreeImage(buildId, slotIndex, filePaths[0], meta)
    },
  )
  ipcMain.handle('haga:clearPassiveTreeImage', (_e, buildId: string, slotIndex: number) =>
    buildService.clearPassiveTreeImage(buildId, slotIndex),
  )
  ipcMain.handle('haga:deletePassiveTreeSlot', (_e, buildId: string, slotIndex: number) =>
    buildService.deletePassiveTreeSlot(buildId, slotIndex),
  )
  ipcMain.handle('haga:saveBuildGemGroup', (_e, buildId: string, group: SaveGemGroupInput) =>
    buildService.saveBuildGemGroup(buildId, group),
  )
  ipcMain.handle('haga:deleteBuildGemGroup', (_e, groupId: string) => buildService.deleteBuildGemGroup(groupId))

  ipcMain.handle('haga:decodePoBShareCode', (_e, code: string) => decodePoBShareCode(code))
  ipcMain.handle('haga:importPoBItems', (_e, code: string) => importPoBItemsFromShareCode(code))

  ipcMain.handle('haga:getItemTags', (_e, rarity: string, uniqueId?: string, baseItemId?: string) =>
    buildService.getItemTagsForBuildItem(rarity as 'unique' | 'rare', uniqueId, baseItemId),
  )
  ipcMain.handle('haga:getItemTagsForSlot', (_e, slotLabel: string) => buildService.getItemTagsForSlot(slotLabel))

  ipcMain.on('haga:closeWindow', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  ipcMain.on('haga:openCampaignPanel', () => {
    showOverlayWindow('campaign-panel')
  })

  ipcMain.on('haga:openDevLocationModal', () => {
    openDevLocationModal()
  })

  ipcMain.on('haga:openDevLevelBox', () => {
    openDevLevelBox()
  })

  ipcMain.on('haga:closeOverlay', (_event, kind: string) => {
    if (kind === 'build-panel') {
      collapseBuildPanel()
    } else if (
      kind === 'hud' ||
      kind === 'campaign-panel' ||
      kind === 'dev-location-modal' ||
      kind === 'dev-level-box'
    ) {
      hideOverlayWindow(kind as 'hud' | 'campaign-panel' | 'dev-location-modal' | 'dev-level-box')
    }
  })

  ipcMain.handle('haga:getHudLayoutMode', () => getHudLayoutMode())

  ipcMain.handle('haga:setHudLayoutMode', (_e, mode: HudLayoutMode, showFooter?: boolean) => {
    setHudLayoutMode(mode, showFooter ?? false)
    return getHudLayoutMode()
  })

  ipcMain.handle('haga:getBuildPanelCollapsed', () => isBuildPanelCollapsed())
  ipcMain.handle('haga:getBuildPanelMaximized', () => isBuildPanelMaximized())
  ipcMain.handle('haga:getBuildPanelDockSide', () => getBuildPanelDockSide())

  ipcMain.on('haga:expandBuildPanel', () => expandBuildPanel())
  ipcMain.on('haga:toggleBuildPanelMaximized', () => toggleBuildPanelMaximized())
  ipcMain.on('haga:toggleBuildPanelDockSide', () => toggleBuildPanelDockSide())

  ipcMain.on('haga:setWindowContentSize', (event, width: number, height: number) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return

    const contentWidth = Math.max(320, Math.min(Math.round(width), 720))
    const contentHeight = Math.max(240, Math.min(Math.round(height), 960))
    const [currentW, currentH] = win.getContentSize()
    if (Math.abs(currentW - contentWidth) < 2 && Math.abs(currentH - contentHeight) < 2) return

    win.setContentSize(contentWidth, contentHeight, false)

    const bounds = win.getBounds()
    const display = screen.getDisplayMatching(bounds)
    const workArea = display.workArea
    win.setBounds({
      x: workArea.x + Math.floor((workArea.width - bounds.width) / 2),
      y: workArea.y + Math.floor((workArea.height - bounds.height) / 2),
      width: bounds.width,
      height: bounds.height,
    })
  })

  ipcMain.on('haga:openSettings', () => windowRefs.openSettings?.())
  ipcMain.on('haga:openAbout', () => windowRefs.openAbout?.())
}
