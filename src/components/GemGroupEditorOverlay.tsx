import { useEffect, useMemo, useState } from 'react'
import type { BuildGemGroup, BuildProfile, RecommendedSupportGem } from '../types/build'
import type { SaveGemGroupInput } from '../types/ipc'
import { allowedLinkedGemTypes, MAIN_GEM_TYPES, MAX_LINKED_GEMS } from '../lib/gemGroups'
import { gemColorBorderClass } from '../lib/gemColors'
import { EditorOverlayFrame } from './EditorOverlayFrame'
import { GemName } from './GemName'
import { GemDetailHover, type GemDetailInfo } from './RecommendedSupportsTooltip'
import { getGemRequiredLevel } from '../lib/gemLevel'

type GemOption = { id: string; name: string; gemType: string; color: string | null }

interface Props {
  build: BuildProfile
  editingGroup: BuildGemGroup | null
  onClose: () => void
  onSaveGroup?: (input: SaveGemGroupInput) => Promise<void>
}

function emptyLinkedSlots(count = MAX_LINKED_GEMS): Array<{ gemId: string; query: string; color: string | null }> {
  return Array.from({ length: count }, () => ({ gemId: '', query: '', color: null }))
}

function getSelectedGemIds(mainGemId: string, linkedSlots: Array<{ gemId: string }>): Set<string> {
  const ids = new Set<string>()
  if (mainGemId) ids.add(mainGemId)
  for (const slot of linkedSlots) {
    if (slot.gemId) ids.add(slot.gemId)
  }
  return ids
}

function filterGemOptions(results: GemOption[], exclude: Set<string>): GemOption[] {
  return results.filter((g) => !exclude.has(g.id))
}

export function GemGroupEditorOverlay({ build, editingGroup, onClose, onSaveGroup }: Props) {
  const [mainQuery, setMainQuery] = useState(editingGroup?.mainGem?.gemName ?? '')
  const [mainGemId, setMainGemId] = useState(editingGroup?.mainGem?.gemId ?? '')
  const [mainResults, setMainResults] = useState<GemOption[]>([])
  const [mainGemType, setMainGemType] = useState(editingGroup?.mainGem?.gemType ?? '')
  const [mainGemColor, setMainGemColor] = useState(editingGroup?.mainGem?.color ?? null)
  const [recommendedSupports, setRecommendedSupports] = useState<RecommendedSupportGem[]>(
    editingGroup?.recommendedSupports ?? [],
  )
  const [mainGemTags, setMainGemTags] = useState<string[]>(editingGroup?.mainGem?.tags ?? [])
  const [mainCraftingLevel, setMainCraftingLevel] = useState<number | null>(
    editingGroup?.mainGem?.craftingLevel ?? null,
  )
  const [linkedSlots, setLinkedSlots] = useState(() => {
    const slots = emptyLinkedSlots()
    for (const linked of editingGroup?.linkedGems ?? []) {
      const idx = linked.linkIndex - 1
      if (idx >= 0 && idx < MAX_LINKED_GEMS) {
        slots[idx] = { gemId: linked.gemId, query: linked.gemName, color: linked.color }
      }
    }
    return slots
  })
  const [linkedResults, setLinkedResults] = useState<GemOption[][]>(() =>
    Array.from({ length: MAX_LINKED_GEMS }, () => []),
  )
  const [notes, setNotes] = useState(editingGroup?.notes ?? '')

  useEffect(() => {
    if (editingGroup?.mainGem) {
      setMainGemType(editingGroup.mainGem.gemType)
    }
  }, [editingGroup])

  const linkedGemTypes = useMemo(() => {
    if (!mainGemType) return []
    return allowedLinkedGemTypes(mainGemType)
  }, [mainGemType])

  const selectedGemIds = useMemo(
    () => getSelectedGemIds(mainGemId, linkedSlots),
    [mainGemId, linkedSlots],
  )

  useEffect(() => {
    if (mainQuery.length < 2) {
      setMainResults([])
      return
    }
    window.haga.searchGems(mainQuery, [...MAIN_GEM_TYPES]).then((results) => {
      setMainResults(filterGemOptions(results, selectedGemIds))
    })
  }, [mainQuery, selectedGemIds])

  useEffect(() => {
    if (!mainGemType || linkedGemTypes.length === 0) {
      setLinkedResults(Array.from({ length: MAX_LINKED_GEMS }, () => []))
      return
    }

    const timers = linkedSlots.map((slot, index) => {
      if (slot.query.length < 2) return null
      return window.setTimeout(() => {
        window.haga.searchGems(slot.query, linkedGemTypes).then((results) => {
          setLinkedResults((prev) => {
            const next = prev.map((row) => [...row])
            next[index] = filterGemOptions(results, selectedGemIds)
            return next
          })
        })
      }, 200)
    })

    return () => {
      for (const timer of timers) {
        if (timer) window.clearTimeout(timer)
      }
    }
  }, [linkedSlots, linkedGemTypes, mainGemType, selectedGemIds])

  useEffect(() => {
    if (!mainGemId) {
      setRecommendedSupports([])
      setMainGemColor(null)
      setMainGemTags([])
      setMainCraftingLevel(null)
      return
    }
    window.haga.getGemDetails(mainGemId).then((details) => {
      if (!details) return
      setMainGemColor(details.color)
      setMainGemType(details.gemType)
      setRecommendedSupports(details.recommendedSupports)
      setMainGemTags(details.tags)
      setMainCraftingLevel(details.craftingLevel)
    })
  }, [mainGemId])

  const pickMain = (gem: GemOption) => {
    const changed = gem.id !== mainGemId
    setMainGemId(gem.id)
    setMainQuery(gem.name)
    setMainGemType(gem.gemType)
    setMainGemColor(gem.color)
    setMainResults([])
    if (changed) setLinkedSlots(emptyLinkedSlots())
  }

  const pickLinked = (index: number, gem: GemOption) => {
    setLinkedSlots((prev) => {
      const next = [...prev]
      next[index] = { gemId: gem.id, query: gem.name, color: gem.color }
      return next
    })
    setLinkedResults((prev) => {
      const next = prev.map((row) => [...row])
      next[index] = []
      return next
    })
  }

  const clearLinked = (index: number) => {
    setLinkedSlots((prev) => {
      const next = [...prev]
      next[index] = { gemId: '', query: '', color: null }
      return next
    })
  }

  const saveGroup = async () => {
    if (!mainGemId) {
      alert('Select a main gem (active or spirit).')
      return
    }

    const input: SaveGemGroupInput = {
      id: editingGroup?.id,
      mainGemId,
      linkedGems: linkedSlots
        .filter((slot) => slot.gemId)
        .map((slot) => ({ gemId: slot.gemId, notes: null })),
      notes: notes || null,
    }

    try {
      if (onSaveGroup) {
        await onSaveGroup(input)
      } else {
        await window.haga.saveBuildGemGroup(build.id, input)
      }
      onClose()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save gem group.')
    }
  }

  return (
    <EditorOverlayFrame title={editingGroup ? 'Edit Gem Group' : 'Add Gem Group'} onClose={onClose}>
      <p className="text-xs text-slate-400">
        Main gem must be <strong>active</strong> or <strong>spirit</strong>. Active mains link up to {MAX_LINKED_GEMS}{' '}
        supports. Spirit mains can link supports or actives.
      </p>

      <GemComboBox
        label="Main gem"
        placeholder="Search active or spirit gem…"
        query={mainQuery}
        selectedId={mainGemId}
        selectedColor={mainGemColor}
        options={mainResults}
        gemDetail={
          mainGemId
            ? {
                requiredLevel: getGemRequiredLevel(mainCraftingLevel),
                tags: mainGemTags,
                supports:
                  mainGemType === 'active' || mainGemType === 'spirit' ? recommendedSupports : [],
              }
            : undefined
        }
        onQueryChange={(value) => {
          setMainQuery(value)
          setMainGemId('')
          setMainGemType('')
          setMainGemColor(null)
          setRecommendedSupports([])
          setMainGemTags([])
          setMainCraftingLevel(null)
        }}
        onPick={pickMain}
      />

      {mainGemId && (
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-400">
            Linked gems ({linkedGemTypes.join(' / ')}) · max {MAX_LINKED_GEMS}
          </div>
          {linkedSlots.map((slot, index) => (
            <GemComboBox
              key={index}
              label={`Link ${index + 1}`}
              placeholder={`Search ${linkedGemTypes.join(' or ')}…`}
              query={slot.query}
              selectedId={slot.gemId}
              selectedColor={slot.color}
              options={linkedResults[index] ?? []}
              onQueryChange={(value) => {
                setLinkedSlots((prev) => {
                  const next = [...prev]
                  next[index] = { gemId: '', query: value, color: null }
                  return next
                })
              }}
              onPick={(gem) => pickLinked(index, gem)}
              onClear={() => clearLinked(index)}
            />
          ))}
        </div>
      )}

      <textarea placeholder="Group notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full" rows={2} />
      <button type="button" className="btn-primary w-full" onClick={saveGroup}>
        Save group
      </button>
    </EditorOverlayFrame>
  )
}

function GemComboBox({
  label,
  placeholder,
  query,
  selectedId,
  selectedColor,
  options,
  gemDetail,
  onQueryChange,
  onPick,
  onClear,
}: {
  label: string
  placeholder: string
  query: string
  selectedId: string
  selectedColor?: string | null
  options: GemOption[]
  gemDetail?: GemDetailInfo
  onQueryChange: (value: string) => void
  onPick: (gem: GemOption) => void
  onClear?: () => void
}) {
  const inputBorderClass = selectedId ? gemColorBorderClass(selectedColor) : ''

  const inputField = (
    <input
      className={`w-full gem-input ${inputBorderClass}`.trim()}
      placeholder={placeholder}
      value={query}
      onChange={(e) => onQueryChange(e.target.value)}
      autoComplete="off"
    />
  )

  return (
    <label className="relative block">
      <span>{label}</span>
      <div className="mt-1 flex gap-2">
        {gemDetail ? (
          <GemDetailHover detail={gemDetail} className="min-w-0 flex-1">
            {inputField}
          </GemDetailHover>
        ) : (
          inputField
        )}
        {selectedId && onClear && (
          <button type="button" className="btn-ghost shrink-0 text-xs" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      {options.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-36 w-full overflow-y-auto rounded border border-slate-600 bg-slate-900 shadow-lg">
          {options.map((gem) => (
            <li key={gem.id}>
              <button
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-800 ${gemColorBorderClass(gem.color)}`}
                onClick={() => onPick(gem)}
              >
                <GemName name={gem.name} color={gem.color} />{' '}
                <span className="text-xs text-slate-400">({gem.gemType})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </label>
  )
}
