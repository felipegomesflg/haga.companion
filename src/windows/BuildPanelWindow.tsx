import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BudgetTier, BuildGemGroup, BuildItem, BuildProfile, PassiveTreeSlot } from '../types/build'
import type { SaveBuildItemInput, SaveGemGroupInput } from '../types/ipc'
import type { EquipmentSlotId } from '../lib/equipmentSlots'
import {
  applyPoBImportToDraft,
  NEW_BUILD_ID,
  nextBuildName,
  toPersistPayload,
} from '../lib/buildDraftUtils'
import {
  createDraftGemPage,
  createEmptyDraftGemGroup,
  defaultDraftGemPages,
  DRAFT_GEM_PAGE_PREFIX,
  getActiveDraftGemPage,
  mergeDbPagesWithDraftGroups,
  setActiveDraftGemPage,
  type DraftGemPage,
} from '../lib/gemPages'
import {
  createDraftEquipPage,
  defaultDraftEquipPages,
  DRAFT_EQUIP_PAGE_PREFIX,
  getActiveDraftEquipPage,
  mergeDbEquipPagesWithDraftItems,
  setActiveDraftEquipPage,
  upsertDraftItemOnPage,
  type DraftEquipPage,
} from '../lib/equipPages'
import { nextTempPageName } from '../lib/pageNames'
import { useI18n } from '../hooks/useI18n'
import { GemsTab } from '../components/GemsTab'
import { EquipsTab } from '../components/EquipsTab'
import { TreeTab } from '../components/TreeTab'
import { EquipEditorOverlay } from '../components/EquipEditorOverlay'
import { GemGroupEditorOverlay } from '../components/GemGroupEditorOverlay'
import { TreeEditorOverlay } from '../components/TreeEditorOverlay'
import { BuildPanelEar } from '../components/BuildPanelEar'
import { BuildPanelDockSideButton } from '../components/BuildPanelDockSideButton'
import { BuildPanelMaximizeButton } from '../components/BuildPanelMaximizeButton'
import { BuildSelector } from '../components/BuildSelector'
import { PobImportStrip } from '../components/PobImportStrip'

type TabId = 'gems' | 'equips' | 'tree'
type EditorKind = 'equip' | 'gem' | 'tree'

type BuildPanelDockSide = 'left' | 'right'

function BuildPanelCollapsed({ dockSide }: { dockSide: BuildPanelDockSide }) {
  return (
    <div className={`build-panel-shell build-panel-shell--collapsed build-panel-shell--dock-${dockSide}`}>
      <BuildPanelEar
        expanded={false}
        dockSide={dockSide}
        onClick={() => window.haga.expandBuildPanel()}
      />
    </div>
  )
}

function emptyDraft(name: string) {
  return {
    buildId: null as string | null,
    selectedId: NEW_BUILD_ID,
    name,
    gemPages: defaultDraftGemPages(),
    equipPages: defaultDraftEquipPages(),
    trees: [] as PassiveTreeSlot[],
  }
}

export function BuildPanelWindow() {
  const { t } = useI18n()
  const [collapsed, setCollapsed] = useState(true)
  const [maximized, setMaximized] = useState(false)
  const [dockSide, setDockSide] = useState<BuildPanelDockSide>('right')
  const [tab, setTab] = useState<TabId>('gems')
  const [profiles, setProfiles] = useState<BuildProfile[]>([])
  const [draftBuildId, setDraftBuildId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState(NEW_BUILD_ID)
  const [draftName, setDraftName] = useState('New Build')
  const [gemPages, setGemPages] = useState<DraftGemPage[]>(defaultDraftGemPages())
  const [equipPages, setEquipPages] = useState<DraftEquipPage[]>(defaultDraftEquipPages())
  const [trees, setTrees] = useState<PassiveTreeSlot[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editorKind, setEditorKind] = useState<EditorKind | null>(null)
  const [editingItem, setEditingItem] = useState<BuildItem | null>(null)
  const [editingSlotId, setEditingSlotId] = useState<EquipmentSlotId>('helmet')
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [characterLevel, setCharacterLevel] = useState<number | null>(null)
  const [gameCharacterName, setGameCharacterName] = useState('')
  const [autoEditGemPageId, setAutoEditGemPageId] = useState<string | null>(null)
  const [autoEditEquipPageId, setAutoEditEquipPageId] = useState<string | null>(null)

  const clearAutoEditGemPage = useCallback(() => setAutoEditGemPageId(null), [])
  const clearAutoEditEquipPage = useCallback(() => setAutoEditEquipPageId(null), [])

  const draftProfile = useMemo<BuildProfile>(
    () => ({
      id: draftBuildId ?? 'draft',
      name: draftName,
      className: null,
      notes: null,
      activeBudgetTier: 'early' as BudgetTier,
      isActive: true,
      gameCharacterName: gameCharacterName || null,
      trackedCharacterLevel: characterLevel,
      createdAt: '',
      updatedAt: '',
    }),
    [draftBuildId, draftName, gameCharacterName, characterLevel],
  )

  const activeGemPage = useMemo(() => getActiveDraftGemPage(gemPages), [gemPages])
  const activeGemGroups = activeGemPage.groups
  const activeEquipPage = useMemo(() => getActiveDraftEquipPage(equipPages), [equipPages])
  const visibleItems = activeEquipPage.items

  const loadDraftFromBuild = useCallback(async (buildId: string) => {
    const profile = (await window.haga.getBuildProfiles()).find((entry) => entry.id === buildId)
    if (!profile) return

    const [pages, equipPageList, treeList] = await Promise.all([
      window.haga.getBuildGemPages(buildId),
      window.haga.getBuildEquipPages(buildId),
      window.haga.getPassiveTrees(buildId),
    ])
    const groupsLists = await Promise.all(pages.map((page) => window.haga.getBuildGemGroups(buildId, page.id)))
    const itemLists = await Promise.all(equipPageList.map((page) => window.haga.getBuildItems(buildId, page.id)))
    const groupsByPageId = new Map(pages.map((page, index) => [page.id, groupsLists[index]]))
    const itemsByPageId = new Map(equipPageList.map((page, index) => [page.id, itemLists[index]]))

    setDraftBuildId(buildId)
    setSelectedId(buildId)
    setDraftName(profile.name)
    setGameCharacterName(profile.gameCharacterName ?? '')
    setCharacterLevel(profile.trackedCharacterLevel)
    setGemPages(mergeDbPagesWithDraftGroups(pages, groupsByPageId))
    setEquipPages(mergeDbEquipPagesWithDraftItems(equipPageList, itemsByPageId))
    setTrees(treeList)
    setIsDirty(false)
    setIsEditingName(false)
  }, [])

  const refreshProfiles = useCallback(async () => {
    const list = await window.haga.getBuildProfiles()
    setProfiles(list)
    return list
  }, [])

  const bootstrap = useCallback(async () => {
    const list = await refreshProfiles()
    if (list.length === 0) {
      const blank = emptyDraft(nextBuildName([]))
      setDraftBuildId(blank.buildId)
      setSelectedId(blank.selectedId)
      setDraftName(blank.name)
      setGemPages(blank.gemPages)
      setEquipPages(blank.equipPages)
      setTrees(blank.trees)
      setIsDirty(false)
      return
    }

    const active = await window.haga.getActiveBuild()
    const targetId = active?.id ?? list[0].id
    if (!active) {
      await window.haga.setActiveBuild(targetId)
    }
    await loadDraftFromBuild(targetId)
  }, [loadDraftFromBuild, refreshProfiles])

  const collapsedSyncedRef = useRef(false)
  const dockSideSyncedRef = useRef(false)

  useEffect(() => {
    const onCollapsed = (event: Event) => {
      collapsedSyncedRef.current = true
      setCollapsed(Boolean((event as CustomEvent<boolean>).detail))
    }
    const onMaximized = (event: Event) => {
      setMaximized(Boolean((event as CustomEvent<boolean>).detail))
    }
    const onDockSide = (event: Event) => {
      dockSideSyncedRef.current = true
      const side = (event as CustomEvent<BuildPanelDockSide>).detail
      setDockSide(side === 'left' ? 'left' : 'right')
    }

    window.addEventListener('haga:buildPanelCollapsed', onCollapsed)
    window.addEventListener('haga:buildPanelMaximized', onMaximized)
    window.addEventListener('haga:buildPanelDockSide', onDockSide)

    void Promise.all([
      window.haga.getBuildPanelCollapsed(),
      window.haga.getBuildPanelMaximized(),
      window.haga.getBuildPanelDockSide(),
    ]).then(([isCollapsed, isMaximized, side]) => {
      if (!collapsedSyncedRef.current) setCollapsed(isCollapsed)
      setMaximized(isMaximized)
      if (!dockSideSyncedRef.current) setDockSide(side === 'left' ? 'left' : 'right')
    })

    return () => {
      window.removeEventListener('haga:buildPanelCollapsed', onCollapsed)
      window.removeEventListener('haga:buildPanelMaximized', onMaximized)
      window.removeEventListener('haga:buildPanelDockSide', onDockSide)
    }
  }, [])

  useEffect(() => {
    if (!collapsed) void bootstrap()
  }, [collapsed, bootstrap])

  useEffect(() => {
    const refreshLevel = () => {
      void window.haga.getGameLocation().then((location) => {
        setCharacterLevel(location.characterLevel)
      })
    }

    refreshLevel()
    window.addEventListener('haga:gameLocationUpdated', refreshLevel)
    return () => window.removeEventListener('haga:gameLocationUpdated', refreshLevel)
  }, [])

  const markDirty = () => setIsDirty(true)

  const closeEditor = () => {
    setEditorKind(null)
    setEditingItem(null)
    setEditingGroupId(null)
  }

  const confirmDiscard = () => !isDirty || confirm('Discard unsaved changes to this build?')

  const onSelectBuild = async (buildId: string) => {
    if (buildId === selectedId) return
    if (!confirmDiscard()) return

    closeEditor()
    if (buildId === NEW_BUILD_ID) {
      onNewBuild()
      return
    }

    await window.haga.setActiveBuild(buildId)
    await loadDraftFromBuild(buildId)
  }

  const onNewBuild = () => {
    if (!confirmDiscard()) return

    closeEditor()
    const blank = emptyDraft(nextBuildName(profiles))
    setDraftBuildId(blank.buildId)
    setSelectedId(NEW_BUILD_ID)
    setDraftName(blank.name)
    setGemPages(blank.gemPages)
    setEquipPages(blank.equipPages)
    setTrees(blank.trees)
    setIsDirty(true)
    setIsEditingName(true)
  }

  const onSaveBuild = async () => {
    if (saving) return
    setSaving(true)
    try {
      const saved = await window.haga.persistBuildDraft(
        toPersistPayload({
          buildId: draftBuildId,
          name: draftName,
          gemPages,
          equipPages,
          trees,
        }),
      )

      await refreshProfiles()
      await loadDraftFromBuild(saved.id)
    } finally {
      setSaving(false)
    }
  }

  const onDraftNameChange = (name: string) => {
    setDraftName(name)
    markDirty()
  }

  const updateEquipPageItems = (pageId: string, updater: (items: BuildItem[]) => BuildItem[]) => {
    setEquipPages((prev) =>
      prev.map((page) => (page.id === pageId ? { ...page, items: updater(page.items) } : page)),
    )
  }

  const saveDraftItem = async (input: SaveBuildItemInput) => {
    const pageId = activeEquipPage.id
    const withPage: SaveBuildItemInput = { ...input, pageId }
    const isPersistedPage = Boolean(draftBuildId && !pageId.startsWith(DRAFT_EQUIP_PAGE_PREFIX))

    try {
      if (isPersistedPage && draftBuildId) {
        const saved = await window.haga.saveBuildItem(draftBuildId, withPage)
        updateEquipPageItems(pageId, (items) => upsertDraftItemOnPage(items, saved))
      } else {
        const preview = await window.haga.previewBuildItem(withPage)
        preview.pageId = pageId
        updateEquipPageItems(pageId, (items) => upsertDraftItemOnPage(items, preview))
      }

      markDirty()
      closeEditor()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save item.')
    }
  }

  const updateGemPageGroups = (pageId: string, updater: (groups: BuildGemGroup[]) => BuildGemGroup[]) => {
    setGemPages((prev) =>
      prev.map((page) => (page.id === pageId ? { ...page, groups: updater(page.groups) } : page)),
    )
  }

  const saveDraftGemGroup = async (input: SaveGemGroupInput) => {
    const pageId = activeGemPage.id
    const withPage: SaveGemGroupInput = { ...input, pageId }
    const isPersistedPage = Boolean(draftBuildId && !pageId.startsWith(DRAFT_GEM_PAGE_PREFIX))

    try {
      if (isPersistedPage && draftBuildId) {
        const saved = await window.haga.saveBuildGemGroup(draftBuildId, withPage)
        updateGemPageGroups(pageId, (groups) => {
          if (input.id) {
            return groups.map((group) => (group.id === input.id ? saved : group))
          }
          return [...groups, saved]
        })
      } else {
        const sortOrder = editingGroup
          ? activeGemGroups.findIndex((group) => group.id === editingGroup.id)
          : activeGemGroups.length
        const preview = await window.haga.previewBuildGemGroup(withPage, Math.max(sortOrder, 0))
        preview.pageId = pageId

        updateGemPageGroups(pageId, (groups) => {
          if (input.id) {
            return groups.map((group) => (group.id === input.id ? preview : group))
          }
          return [...groups, preview]
        })
      }

      markDirty()
      closeEditor()
    } catch (err) {
      alert(err instanceof Error ? err.message : t.build.gemEditor.saveFailed)
    }
  }

  const deleteGemGroup = async (groupId: string) => {
    if (!confirm(t.build.deleteGemGroup)) return
    try {
      if (draftBuildId && !activeGemPage.id.startsWith(DRAFT_GEM_PAGE_PREFIX)) {
        await window.haga.deleteBuildGemGroup(groupId)
      }
      updateGemPageGroups(activeGemPage.id, (groups) => groups.filter((group) => group.id !== groupId))
      markDirty()
    } catch (err) {
      alert(err instanceof Error ? err.message : t.build.gemEditor.saveFailed)
    }
  }

  const selectGemPage = async (pageId: string) => {
    setGemPages((prev) => setActiveDraftGemPage(prev, pageId))
    if (draftBuildId) {
      await window.haga.setActiveGemPage(draftBuildId, pageId)
    }
  }

  const addGemPage = async () => {
    const title = nextTempPageName(gemPages.map((p) => p.title))

    if (draftBuildId) {
      const page = await window.haga.createBuildGemPage(draftBuildId, title)
      const groups = await window.haga.getBuildGemGroups(draftBuildId, page.id)
      setGemPages((prev) => [
        ...prev.map((p) => ({ ...p, isActive: false })),
        { id: page.id, title: page.title, sortOrder: page.sortOrder, isActive: true, groups },
      ])
      setAutoEditGemPageId(page.id)
    } else {
      const page = createDraftGemPage(title, gemPages.length, true)
      setGemPages((prev) => [...prev.map((p) => ({ ...p, isActive: false })), page])
      setAutoEditGemPageId(page.id)
      markDirty()
    }
  }

  const renameGemPage = async (pageId: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return

    const page = gemPages.find((p) => p.id === pageId)
    if (!page || page.title === trimmed) return

    if (draftBuildId && !pageId.startsWith(DRAFT_GEM_PAGE_PREFIX)) {
      const updated = await window.haga.renameBuildGemPage(pageId, trimmed)
      setGemPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, title: updated.title } : p)))
    } else {
      setGemPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, title: trimmed } : p)))
      markDirty()
    }
  }

  const deleteGemPage = async (pageId: string) => {
    if (draftBuildId && !pageId.startsWith(DRAFT_GEM_PAGE_PREFIX)) {
      await window.haga.deleteBuildGemPage(pageId)
      const pages = await window.haga.getBuildGemPages(draftBuildId)
      const groupsLists = await Promise.all(pages.map((p) => window.haga.getBuildGemGroups(draftBuildId, p.id)))
      const groupsByPageId = new Map(pages.map((p, index) => [p.id, groupsLists[index]]))
      setGemPages(mergeDbPagesWithDraftGroups(pages, groupsByPageId))
    } else {
      setGemPages((prev) => {
        const next = prev.filter((p) => p.id !== pageId)
        if (!next.some((p) => p.isActive) && next.length > 0) {
          next[0].isActive = true
        }
        return next
      })
      markDirty()
    }
  }

  const selectEquipPage = async (pageId: string) => {
    setEquipPages((prev) => setActiveDraftEquipPage(prev, pageId))
    if (draftBuildId && !pageId.startsWith(DRAFT_EQUIP_PAGE_PREFIX)) {
      await window.haga.setActiveEquipPage(draftBuildId, pageId)
    }
  }

  const addEquipPage = async () => {
    const title = nextTempPageName(equipPages.map((p) => p.title))

    if (draftBuildId) {
      const page = await window.haga.createBuildEquipPage(draftBuildId, title)
      const items = await window.haga.getBuildItems(draftBuildId, page.id)
      setEquipPages((prev) => [
        ...prev.map((p) => ({ ...p, isActive: false })),
        { id: page.id, title: page.title, sortOrder: page.sortOrder, isActive: true, items },
      ])
      setAutoEditEquipPageId(page.id)
    } else {
      const page = createDraftEquipPage(title, equipPages.length, true)
      setEquipPages((prev) => [...prev.map((p) => ({ ...p, isActive: false })), page])
      setAutoEditEquipPageId(page.id)
      markDirty()
    }
  }

  const renameEquipPage = async (pageId: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return

    const page = equipPages.find((p) => p.id === pageId)
    if (!page || page.title === trimmed) return

    if (draftBuildId && !pageId.startsWith(DRAFT_EQUIP_PAGE_PREFIX)) {
      const updated = await window.haga.renameBuildEquipPage(pageId, trimmed)
      setEquipPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, title: updated.title } : p)))
    } else {
      setEquipPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, title: trimmed } : p)))
      markDirty()
    }
  }

  const deleteEquipPage = async (pageId: string) => {
    if (draftBuildId && !pageId.startsWith(DRAFT_EQUIP_PAGE_PREFIX)) {
      await window.haga.deleteBuildEquipPage(pageId)
      const pages = await window.haga.getBuildEquipPages(draftBuildId)
      const itemLists = await Promise.all(pages.map((p) => window.haga.getBuildItems(draftBuildId, p.id)))
      const itemsByPageId = new Map(pages.map((p, index) => [p.id, itemLists[index]]))
      setEquipPages(mergeDbEquipPagesWithDraftItems(pages, itemsByPageId))
    } else {
      setEquipPages((prev) => {
        const next = prev.filter((p) => p.id !== pageId)
        if (!next.some((p) => p.isActive) && next.length > 0) {
          next[0].isActive = true
        }
        return next
      })
      markDirty()
    }
  }

  const saveDraftTrees = (nextTrees: PassiveTreeSlot[]) => {
    setTrees(nextTrees)
    markDirty()
    closeEditor()
  }

  const importPoBToDraft = async (code: string) => {
    console.log('[pob-import] UI: import to draft iniciado')
    const parsed = await window.haga.parsePoBImport(code)
    const equipItemCount = parsed.equipPages.reduce((n, p) => n + p.items.length, 0)
    console.log('[pob-import] UI: parse retornou', {
      equipPages: parsed.equipPages.length,
      equipItems: equipItemCount,
      gemPages: parsed.gemPages.length,
    })
    const merged = await applyPoBImportToDraft(parsed.equipPages, parsed.gemPages)
    setEquipPages(merged.equipPages)
    setGemPages(merged.gemPages)
    markDirty()
    if (equipItemCount > 0) {
      setTab('equips')
    }
    console.log('[pob-import] UI: draft marcado como dirty — lembre de Save build', {
      paginasEquip: parsed.equipPages.length,
      itensImportados: equipItemCount,
      aba: equipItemCount > 0 ? 'equips' : tab,
    })
  }

  const openItemEditor = (slotId: EquipmentSlotId, item: BuildItem | null = null) => {
    setEditingSlotId(slotId)
    setEditingItem(item)
    setEditorKind('equip')
  }

  const addGemGroup = () => {
    const pageId = activeGemPage.id
    const label = nextTempPageName(
      activeGemGroups.map((group) => group.notes?.trim() || group.mainGem?.gemName || '').filter(Boolean),
    )
    const group = createEmptyDraftGemGroup(pageId, activeGemGroups.length, label)
    updateGemPageGroups(pageId, (groups) => [...groups, group])
    markDirty()
  }

  const renameGemGroupLabel = (groupId: string, label: string) => {
    updateGemPageGroups(activeGemPage.id, (groups) =>
      groups.map((group) => (group.id === groupId ? { ...group, notes: label } : group)),
    )
    markDirty()
  }

  const openGemGroupEditor = (groupId?: string) => {
    setEditingGroupId(groupId ?? null)
    setEditorKind('gem')
  }

  const openTreeEditor = () => {
    setEditorKind('tree')
  }

  const editingGroup = editingGroupId
    ? activeGemGroups.find((group) => group.id === editingGroupId) ?? null
    : null

  const selectorProfiles = useMemo(() => {
    const options = profiles.map((profile) => ({ id: profile.id, name: profile.name }))
    if (selectedId === NEW_BUILD_ID) {
      return [{ id: NEW_BUILD_ID, name: `${draftName.trim() || 'New Build'} (unsaved)` }, ...options]
    }
    return options
  }, [profiles, selectedId, draftName])

  if (collapsed) {
    return <BuildPanelCollapsed dockSide={dockSide} />
  }

  return (
    <div className={`build-panel-shell build-panel-shell--expanded build-panel-shell--dock-${dockSide}`}>
      {dockSide === 'right' && (
        <BuildPanelEar
          expanded
          dockSide={dockSide}
          onClick={() => window.haga.closeOverlay('build-panel')}
        />
      )}

      <div className="overlay-panel build-panel-main flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-slate-700 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <BuildSelector
              profiles={selectorProfiles}
              selectedId={selectedId}
              draftName={draftName}
              isEditingName={isEditingName}
              isDirty={isDirty}
              saving={saving}
              onSelect={(id) => void onSelectBuild(id)}
              onDraftNameChange={onDraftNameChange}
              onToggleEditName={() => setIsEditingName((value) => !value)}
              onNewBuild={onNewBuild}
              onSave={() => void onSaveBuild()}
            />
            <div className="flex shrink-0 items-center gap-1">
              <BuildPanelDockSideButton
                dockSide={dockSide}
                onClick={() => window.haga.toggleBuildPanelDockSide()}
              />
              <BuildPanelMaximizeButton
                maximized={maximized}
                onClick={() => window.haga.toggleBuildPanelMaximized()}
              />
            </div>
          </div>
          <PobImportStrip onImport={importPoBToDraft} />
        </header>

        <nav className="flex border-b border-slate-700 px-2">
          {(['gems', 'equips', 'tree'] as TabId[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`px-4 py-2 text-sm capitalize ${tab === id ? 'tab-active' : 'tab-inactive'}`}
              onClick={() => setTab(id)}
            >
              {id}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'gems' && (
            <GemsTab
              pages={gemPages}
              groups={activeGemGroups}
              characterLevel={characterLevel}
              autoEditPageId={autoEditGemPageId}
              onAutoEditPageDone={clearAutoEditGemPage}
              onSelectPage={(pageId) => void selectGemPage(pageId)}
              onAddPage={() => void addGemPage()}
              onRenamePage={(pageId, title) => void renameGemPage(pageId, title)}
              onDeletePage={(pageId) => void deleteGemPage(pageId)}
              onAddGroup={addGemGroup}
              onRenameGroupLabel={renameGemGroupLabel}
              onEditGroup={openGemGroupEditor}
              onDeleteGroup={(groupId) => void deleteGemGroup(groupId)}
            />
          )}
          {tab === 'equips' && (
            <EquipsTab
              pages={equipPages}
              items={visibleItems}
              autoEditPageId={autoEditEquipPageId}
              onAutoEditPageDone={clearAutoEditEquipPage}
              onSelectPage={(pageId) => void selectEquipPage(pageId)}
              onAddPage={() => void addEquipPage()}
              onRenamePage={(pageId, title) => void renameEquipPage(pageId, title)}
              onDeletePage={(pageId) => void deleteEquipPage(pageId)}
              onEditSlot={openItemEditor}
            />
          )}
          {tab === 'tree' && <TreeTab trees={trees} onEdit={openTreeEditor} />}
        </div>

        {editorKind === 'equip' && (
          <EquipEditorOverlay
            build={draftProfile}
            pageId={activeEquipPage.id}
            editingSlotId={editingSlotId}
            editingItem={editingItem}
            onClose={closeEditor}
            onSaveItem={saveDraftItem}
          />
        )}
        {editorKind === 'gem' && (
          <GemGroupEditorOverlay
            build={draftProfile}
            editingGroup={editingGroup}
            onClose={closeEditor}
            onSaveGroup={saveDraftGemGroup}
          />
        )}
        {editorKind === 'tree' && (
          <TreeEditorOverlay
            build={draftProfile}
            draftMode
            initialTrees={trees}
            onSaveDraft={saveDraftTrees}
            onClose={closeEditor}
          />
        )}
      </div>

      {dockSide === 'left' && (
        <BuildPanelEar
          expanded
          dockSide={dockSide}
          onClick={() => window.haga.closeOverlay('build-panel')}
        />
      )}
    </div>
  )
}
