import { useEffect, useMemo, useState } from 'react'
import type { BudgetTier, BuildItem, BuildProfile } from '../types/build'
import type { EquipmentSlotId } from '../lib/equipmentSlots'
import { getRareDisplayName, getSlotDef, isMainHandSlot, isOffHandSlot } from '../lib/equipmentSlots'
import type { SaveBuildItemInput } from '../types/ipc'
import { EditorOverlayFrame } from './EditorOverlayFrame'

interface Props {
  build: BuildProfile
  budgetTier: BudgetTier
  editingSlotId: EquipmentSlotId
  editingItem: BuildItem | null
  onClose: () => void
  onSaveItem?: (input: SaveBuildItemInput) => Promise<void>
}

type ItemOption = { id: string; name: string; itemClass: string }

export function EquipEditorOverlay({ build, budgetTier, editingSlotId, editingItem, onClose, onSaveItem }: Props) {
  const slotDef = getSlotDef(editingSlotId)
  const [rarity, setRarity] = useState<'unique' | 'rare'>(editingItem?.rarity ?? 'unique')
  const [uniqueQuery, setUniqueQuery] = useState(editingItem?.uniqueName ?? '')
  const [baseQuery, setBaseQuery] = useState(editingItem?.baseItemName ?? '')
  const [uniqueResults, setUniqueResults] = useState<ItemOption[]>([])
  const [baseResults, setBaseResults] = useState<ItemOption[]>([])
  const [uniqueId, setUniqueId] = useState(editingItem?.uniqueId ?? '')
  const [baseItemId, setBaseItemId] = useState(editingItem?.baseItemId ?? '')
  const [notes, setNotes] = useState(editingItem?.notes ?? '')
  const [prefixMods, setPrefixMods] = useState<string[]>(
    editingItem?.mods.filter((m) => m.generationType === 'prefix').map((m) => m.modId) ?? [],
  )
  const [suffixMods, setSuffixMods] = useState<string[]>(
    editingItem?.mods.filter((m) => m.generationType === 'suffix').map((m) => m.modId) ?? [],
  )
  const [modLabels, setModLabels] = useState<Record<string, string>>(() => {
    const labels: Record<string, string> = {}
    for (const mod of editingItem?.mods ?? []) labels[mod.modId] = mod.modText
    return labels
  })
  const [modTags, setModTags] = useState<string[]>([])

  const slotLabel = editingSlotId
  const isRare = rarity === 'rare'
  const selectedModIds = useMemo(() => [...prefixMods, ...suffixMods], [prefixMods, suffixMods])

  useEffect(() => {
    if (rarity !== 'unique') return
    window.haga.searchUniques(uniqueQuery, slotLabel).then(setUniqueResults)
  }, [uniqueQuery, rarity, slotLabel])

  useEffect(() => {
    if (rarity !== 'rare') return
    window.haga.searchBaseItems(baseQuery, slotLabel).then(setBaseResults)
  }, [baseQuery, rarity, slotLabel])

  useEffect(() => {
    if (rarity !== 'rare') {
      setModTags([])
      return
    }
    if (baseItemId) {
      window.haga.getItemTags('rare', null, baseItemId).then(setModTags)
      return
    }
    window.haga.getItemTagsForSlot(slotLabel).then(setModTags)
  }, [rarity, baseItemId, slotLabel])

  useEffect(() => {
    if (rarity === 'unique') {
      setBaseItemId('')
      setBaseQuery('')
      setPrefixMods([])
      setSuffixMods([])
      setModLabels({})
    } else {
      setUniqueId('')
      setUniqueQuery('')
    }
  }, [rarity])

  const saveItem = async () => {
    if (rarity === 'unique' && !uniqueId) {
      alert('Select a unique item.')
      return
    }
    if (rarity === 'rare' && !baseItemId) {
      alert('Select a base item type for mod filtering.')
      return
    }

    if (isOffHandSlot(editingSlotId)) {
      const selectedUnique = uniqueResults.find((u) => u.id === uniqueId)
      const selectedBase = baseResults.find((b) => b.id === baseItemId)
      const itemClass = rarity === 'unique' ? selectedUnique?.itemClass : selectedBase?.itemClass
      if (itemClass && /two hand/i.test(itemClass)) {
        alert('Off-hand slot only accepts shields or one-handed weapons.')
        return
      }
    }

    const input: SaveBuildItemInput = {
      id: editingItem?.id,
      budgetTier,
      rarity,
      uniqueId: rarity === 'unique' ? uniqueId : null,
      baseItemId: rarity === 'rare' ? baseItemId : null,
      slotLabel: editingSlotId,
      priority: editingItem?.priority ?? 0,
      notes,
      mods: isRare
        ? [
            ...prefixMods.slice(0, 3).map((modId, slotIndex) => ({ modId, generationType: 'prefix' as const, slotIndex })),
            ...suffixMods.slice(0, 3).map((modId, slotIndex) => ({ modId, generationType: 'suffix' as const, slotIndex })),
          ]
        : [],
    }
    if (onSaveItem) {
      await onSaveItem(input)
    } else {
      await window.haga.saveBuildItem(build.id, input)
    }
    onClose()
  }

  const pickUnique = (item: ItemOption) => {
    setUniqueId(item.id)
    setUniqueQuery(item.name)
    setUniqueResults([])
  }

  const pickBase = (item: ItemOption) => {
    setBaseItemId(item.id)
    setBaseQuery(item.name)
    setBaseResults([])
  }

  const addMod = (generationType: 'prefix' | 'suffix', mod: { id: string; text: string }) => {
    if (selectedModIds.includes(mod.id)) return
    setModLabels((prev) => ({ ...prev, [mod.id]: mod.text }))
    if (generationType === 'prefix') setPrefixMods((prev) => (prev.length < 3 ? [...prev, mod.id] : prev))
    else setSuffixMods((prev) => (prev.length < 3 ? [...prev, mod.id] : prev))
  }

  const removeMod = (generationType: 'prefix' | 'suffix', modId: string) => {
    if (generationType === 'prefix') setPrefixMods((prev) => prev.filter((id) => id !== modId))
    else setSuffixMods((prev) => prev.filter((id) => id !== modId))
  }

  return (
    <EditorOverlayFrame title={`Edit Equipment — ${slotDef.label}`} onClose={onClose}>
      <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200">
        Slot: {slotDef.label}
        {isMainHandSlot(editingSlotId) && (
          <span className="mt-1 block text-xs font-normal text-slate-400">
            Two-handed weapons occupy both weapon slots.
          </span>
        )}
        {isOffHandSlot(editingSlotId) && (
          <span className="mt-1 block text-xs font-normal text-slate-400">Shield or one-handed weapon only.</span>
        )}
      </div>

      <label className="block">
        Rarity
        <select className="mt-1 w-full" value={rarity} onChange={(e) => setRarity(e.target.value as 'unique' | 'rare')}>
          <option value="unique">Unique</option>
          <option value="rare">Rare</option>
        </select>
      </label>

      {rarity === 'unique' ? (
        <ItemComboBox
          label="Unique"
          placeholder={`Search ${slotDef.label.toLowerCase()} uniques…`}
          query={uniqueQuery}
          onQueryChange={(value) => {
            setUniqueQuery(value)
            setUniqueId('')
          }}
          options={uniqueResults}
          onPick={pickUnique}
        />
      ) : (
        <>
          <div className="rounded border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm font-medium text-slate-100">
            {getRareDisplayName(editingSlotId)}
          </div>
          <ItemComboBox
            label="Base type"
            placeholder={`Search ${slotDef.label.toLowerCase()} bases…`}
            hint="Used only to filter valid prefixes and suffixes."
            query={baseQuery}
            onQueryChange={(value) => {
              setBaseQuery(value)
              setBaseItemId('')
            }}
            options={baseResults}
            onPick={pickBase}
          />

          <ModPicker
            title="Prefixes (max 3)"
            generationType="prefix"
            mods={prefixMods}
            modLabels={modLabels}
            modTags={modTags}
            excludeModIds={selectedModIds}
            onAdd={(mod) => addMod('prefix', mod)}
            onRemove={(modId) => removeMod('prefix', modId)}
            disabled={!baseItemId}
            disabledHint="Select a base type first."
          />
          <ModPicker
            title="Suffixes (max 3)"
            generationType="suffix"
            mods={suffixMods}
            modLabels={modLabels}
            modTags={modTags}
            excludeModIds={selectedModIds}
            onAdd={(mod) => addMod('suffix', mod)}
            onRemove={(modId) => removeMod('suffix', modId)}
            disabled={!baseItemId}
            disabledHint="Select a base type first."
          />
        </>
      )}

      <textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full" rows={2} />

      <button type="button" className="btn-primary w-full" onClick={saveItem}>
        Save item
      </button>
    </EditorOverlayFrame>
  )
}

function ItemComboBox({
  label,
  placeholder,
  hint,
  query,
  onQueryChange,
  options,
  onPick,
}: {
  label: string
  placeholder: string
  hint?: string
  query: string
  onQueryChange: (value: string) => void
  options: ItemOption[]
  onPick: (item: ItemOption) => void
}) {
  const showList = options.length > 0

  return (
    <label className="relative block">
      <span>{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-slate-400">{hint}</span>}
      <input
        className="mt-1 w-full"
        placeholder={placeholder}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        autoComplete="off"
      />
      {showList && (
        <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded border border-slate-600 bg-slate-900 shadow-lg">
          {options.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-800"
                onClick={() => onPick(item)}
              >
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </label>
  )
}

function ModPicker({
  title,
  generationType,
  mods,
  modLabels,
  modTags,
  excludeModIds,
  onAdd,
  onRemove,
  disabled,
  disabledHint,
}: {
  title: string
  generationType: 'prefix' | 'suffix'
  mods: string[]
  modLabels: Record<string, string>
  modTags: string[]
  excludeModIds: string[]
  onAdd: (mod: { id: string; text: string }) => void
  onRemove: (modId: string) => void
  disabled?: boolean
  disabledHint?: string
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: string; text: string }>>([])

  useEffect(() => {
    if (disabled || mods.length >= 3 || !query.trim()) {
      setResults([])
      return
    }
    const timer = window.setTimeout(() => {
      window.haga.searchMods(query.trim(), modTags, generationType, excludeModIds).then(setResults)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [query, modTags, generationType, excludeModIds, disabled, mods.length])

  const pick = (mod: { id: string; text: string }) => {
    onAdd(mod)
    setQuery('')
    setResults([])
  }

  return (
    <div>
      <div className="mb-1 font-medium">{title}</div>
      <div className="space-y-2">
        {mods.map((id) => (
          <div key={id} className="flex items-center justify-between rounded bg-slate-900 px-2 py-1 text-xs">
            <span>{modLabels[id] ?? id}</span>
            <button type="button" onClick={() => onRemove(id)}>
              −
            </button>
          </div>
        ))}
        {disabled && disabledHint && <p className="text-xs text-slate-500">{disabledHint}</p>}
        {!disabled && mods.length < 3 && (
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to search modifier…"
              className="w-full"
              autoComplete="off"
            />
            {results.length > 0 && (
              <ul className="absolute z-10 mt-1 max-h-36 w-full overflow-y-auto rounded border border-slate-600 bg-slate-900 shadow-lg">
                {results.map((mod) => (
                  <li key={mod.id}>
                    <button
                      type="button"
                      className="block w-full px-2 py-1.5 text-left text-xs hover:bg-slate-800"
                      onClick={() => pick(mod)}
                    >
                      {mod.text}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
