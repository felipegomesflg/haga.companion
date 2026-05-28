import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BudgetTier, BuildGemGroup, BuildItem, BuildProfile, PassiveTreeSlot } from '../types/build'
import type { SaveBuildItemInput, SaveGemGroupInput } from '../types/ipc'
import type { EquipmentSlotId } from '../lib/equipmentSlots'
import {
  applyPoBImportToDraft,
  itemsForBudget,
  NEW_BUILD_ID,
  nextBuildName,
  toPersistPayload,
  upsertDraftItem,
} from '../lib/buildDraftUtils'
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

const BUDGET_TIERS: BudgetTier[] = ['early', 'medium', 'high']

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

function emptyDraft(name: string, budgetTier: BudgetTier = 'early') {
  return {
    buildId: null as string | null,
    selectedId: NEW_BUILD_ID,
    name,
    budgetTier,
    gemGroups: [] as BuildGemGroup[],
    items: [] as BuildItem[],
    trees: [] as PassiveTreeSlot[],
  }
}

export function BuildPanelWindow() {
  const [collapsed, setCollapsed] = useState(true)
  const [maximized, setMaximized] = useState(false)
  const [dockSide, setDockSide] = useState<BuildPanelDockSide>('right')
  const [tab, setTab] = useState<TabId>('gems')
  const [profiles, setProfiles] = useState<BuildProfile[]>([])
  const [draftBuildId, setDraftBuildId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState(NEW_BUILD_ID)
  const [draftName, setDraftName] = useState('New Build')
  const [budgetTier, setBudgetTier] = useState<BudgetTier>('early')
  const [gemGroups, setGemGroups] = useState<BuildGemGroup[]>([])
  const [items, setItems] = useState<BuildItem[]>([])
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

  const draftProfile = useMemo<BuildProfile>(
    () => ({
      id: draftBuildId ?? 'draft',
      name: draftName,
      className: null,
      notes: null,
      activeBudgetTier: budgetTier,
      isActive: true,
      gameCharacterName: gameCharacterName || null,
      trackedCharacterLevel: characterLevel,
      createdAt: '',
      updatedAt: '',
    }),
    [draftBuildId, draftName, budgetTier, gameCharacterName, characterLevel],
  )

  const visibleItems = useMemo(() => itemsForBudget(items, budgetTier), [items, budgetTier])

  const loadDraftFromBuild = useCallback(async (buildId: string) => {
    const profile = (await window.haga.getBuildProfiles()).find((entry) => entry.id === buildId)
    if (!profile) return

    const itemLists = await Promise.all(BUDGET_TIERS.map((tier) => window.haga.getBuildItems(buildId, tier)))
    const [groups, treeList] = await Promise.all([
      window.haga.getBuildGemGroups(buildId),
      window.haga.getPassiveTrees(buildId),
    ])

    setDraftBuildId(buildId)
    setSelectedId(buildId)
    setDraftName(profile.name)
    setBudgetTier(profile.activeBudgetTier)
    setGameCharacterName(profile.gameCharacterName ?? '')
    setCharacterLevel(profile.trackedCharacterLevel)
    setGemGroups(groups)
    setItems(itemLists.flat())
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
      setBudgetTier(blank.budgetTier)
      setGemGroups(blank.gemGroups)
      setItems(blank.items)
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
    setBudgetTier(blank.budgetTier)
    setGemGroups(blank.gemGroups)
    setItems(blank.items)
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
          budgetTier,
          gemGroups,
          items,
          trees,
        }),
      )

      await refreshProfiles()
      await loadDraftFromBuild(saved.id)
    } finally {
      setSaving(false)
    }
  }

  const onBudgetChange = (tier: BudgetTier) => {
    setBudgetTier(tier)
    markDirty()
  }

  const onDraftNameChange = (name: string) => {
    setDraftName(name)
    markDirty()
  }

  const saveDraftItem = async (input: SaveBuildItemInput) => {
    const preview = await window.haga.previewBuildItem(input)
    setItems((prev) => upsertDraftItem(prev, preview))
    markDirty()
    closeEditor()
  }

  const saveDraftGemGroup = async (input: SaveGemGroupInput) => {
    const sortOrder = editingGroup
      ? gemGroups.findIndex((group) => group.id === editingGroup.id)
      : gemGroups.length
    const preview = await window.haga.previewBuildGemGroup(input, Math.max(sortOrder, 0))

    setGemGroups((prev) => {
      if (input.id) {
        return prev.map((group) => (group.id === input.id ? preview : group))
      }
      return [...prev, preview]
    })
    markDirty()
    closeEditor()
  }

  const deleteGemGroup = (groupId: string) => {
    if (!confirm('Delete this gem group?')) return
    setGemGroups((prev) => prev.filter((group) => group.id !== groupId))
    markDirty()
  }

  const saveDraftTrees = (nextTrees: PassiveTreeSlot[]) => {
    setTrees(nextTrees)
    markDirty()
    closeEditor()
  }

  const importPoBToDraft = async (code: string) => {
    console.log('[pob-import] UI: import to draft iniciado', { budgetTier })
    const parsed = await window.haga.parsePoBImport(code, budgetTier)
    console.log('[pob-import] UI: parse retornou', {
      items: parsed.items.length,
      gemGroups: parsed.gemGroups.length,
    })
    const merged = await applyPoBImportToDraft(items, parsed.items, parsed.gemGroups)
    setItems(merged.items)
    setGemGroups(merged.gemGroups)
    markDirty()
    if (parsed.items.length > 0) {
      setTab('equips')
    }
    console.log('[pob-import] UI: draft marcado como dirty — lembre de Save build', {
      itemsImportados: parsed.items.length,
      aba: parsed.items.length > 0 ? 'equips' : tab,
    })
  }

  const openItemEditor = (slotId: EquipmentSlotId, item: BuildItem | null = null) => {
    setEditingSlotId(slotId)
    setEditingItem(item)
    setEditorKind('equip')
  }

  const openGemGroupEditor = (groupId?: string) => {
    setEditingGroupId(groupId ?? null)
    setEditorKind('gem')
  }

  const openTreeEditor = () => {
    setEditorKind('tree')
  }

  const editingGroup = editingGroupId ? gemGroups.find((group) => group.id === editingGroupId) ?? null : null

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
              groups={gemGroups}
              characterLevel={characterLevel}
              onAddGroup={() => openGemGroupEditor()}
              onEditGroup={openGemGroupEditor}
              onDeleteGroup={deleteGemGroup}
            />
          )}
          {tab === 'equips' && (
            <EquipsTab
              items={visibleItems}
              budgetTier={budgetTier}
              onBudgetChange={onBudgetChange}
              onEditSlot={openItemEditor}
            />
          )}
          {tab === 'tree' && <TreeTab trees={trees} onEdit={openTreeEditor} />}
        </div>
      </div>

      {dockSide === 'left' && (
        <BuildPanelEar
          expanded
          dockSide={dockSide}
          onClick={() => window.haga.closeOverlay('build-panel')}
        />
      )}

      {editorKind === 'equip' && (
        <EquipEditorOverlay
          build={draftProfile}
          budgetTier={budgetTier}
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
  )
}
