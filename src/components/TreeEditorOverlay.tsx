import { useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { BuildProfile, PassiveTreeSlot } from '../types/build'
import { MAX_PASSIVE_TREES, nextPassiveTreeSlotIndex } from '../lib/passiveTrees'
import { EditorOverlayFrame } from './EditorOverlayFrame'
import { PassiveTreeImage } from './PassiveTreeImage'

interface Props {
  build: BuildProfile
  onClose: () => void
  draftMode?: boolean
  initialTrees?: PassiveTreeSlot[]
  onSaveDraft?: (trees: PassiveTreeSlot[]) => void
}

type TreeEntry = {
  clientId: string
  slotIndex: number
  levelLabel: string
  notes: string
  imageUrl: string | null
  persisted: boolean
}

function fromSavedTree(tree: {
  slotIndex: number
  levelLabel: string
  notes: string | null
  imageUrl: string | null
}): TreeEntry {
  return {
    clientId: uuidv4(),
    slotIndex: tree.slotIndex,
    levelLabel: tree.levelLabel,
    notes: tree.notes ?? '',
    imageUrl: tree.imageUrl,
    persisted: true,
  }
}

export function TreeEditorOverlay({ build, onClose, draftMode = false, initialTrees = [], onSaveDraft }: Props) {
  const [entries, setEntries] = useState<TreeEntry[]>([])
  const [busySlot, setBusySlot] = useState<number | null>(null)

  useEffect(() => {
    if (draftMode) {
      setEntries(initialTrees.map(fromSavedTree))
      return
    }
    window.haga.getPassiveTrees(build.id).then((trees) => {
      setEntries(trees.map(fromSavedTree))
    })
  }, [build.id, draftMode, initialTrees])

  const updateEntry = (clientId: string, patch: Partial<TreeEntry>) => {
    setEntries((prev) => prev.map((entry) => (entry.clientId === clientId ? { ...entry, ...patch } : entry)))
  }

  const addTree = () => {
    const nextIndex = nextPassiveTreeSlotIndex(entries.map((entry) => entry.slotIndex))
    if (nextIndex === null) return

    setEntries((prev) => [
      ...prev,
      {
        clientId: uuidv4(),
        slotIndex: nextIndex,
        levelLabel: '',
        notes: '',
        imageUrl: null,
        persisted: false,
      },
    ])
  }

  const requireLevelLabel = (entry: TreeEntry): string | null => {
    const label = entry.levelLabel.trim()
    if (!label) {
      alert('Enter a level label for this tree (e.g. Level 45).')
      return null
    }
    return label
  }

  const uploadImage = async (entry: TreeEntry) => {
    if (draftMode) {
      alert('Save the build first to upload passive tree images.')
      return
    }
    const levelLabel = requireLevelLabel(entry)
    if (!levelLabel) return

    setBusySlot(entry.slotIndex)
    try {
      const saved = await window.haga.uploadPassiveTreeImage(build.id, entry.slotIndex, {
        levelLabel,
        notes: entry.notes.trim() || null,
      })
      if (saved) {
        updateEntry(entry.clientId, {
          levelLabel: saved.levelLabel,
          notes: saved.notes ?? '',
          imageUrl: saved.imageUrl,
          persisted: true,
        })
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload image.')
    } finally {
      setBusySlot(null)
    }
  }

  const removeImage = async (entry: TreeEntry) => {
    if (draftMode) {
      updateEntry(entry.clientId, { imageUrl: null, persisted: false })
      return
    }
    setBusySlot(entry.slotIndex)
    try {
      const saved = await window.haga.clearPassiveTreeImage(build.id, entry.slotIndex)
      updateEntry(entry.clientId, {
        imageUrl: saved?.imageUrl ?? null,
        persisted: Boolean(saved),
      })
    } finally {
      setBusySlot(null)
    }
  }

  const deleteTree = async (entry: TreeEntry) => {
    const label = entry.levelLabel.trim() || 'this tree'
    if (!confirm(`Remove "${label}"?`)) return

    setBusySlot(entry.slotIndex)
    try {
      if (!draftMode && entry.persisted) {
        await window.haga.deletePassiveTreeSlot(build.id, entry.slotIndex)
      }
      setEntries((prev) => prev.filter((item) => item.clientId !== entry.clientId))
    } finally {
      setBusySlot(null)
    }
  }

  const saveTrees = async () => {
    for (const entry of entries) {
      const levelLabel = entry.levelLabel.trim()
      const hasContent = entry.persisted || entry.notes.trim() || entry.imageUrl
      if (!hasContent) continue
      if (!levelLabel) {
        alert('Every tree needs a level label before saving.')
        return
      }
    }

    if (draftMode && onSaveDraft) {
      onSaveDraft(
        entries
          .filter((entry) => entry.levelLabel.trim())
          .map((entry) => ({
            id: entry.clientId,
            buildId: build.id,
            slotIndex: entry.slotIndex,
            levelLabel: entry.levelLabel.trim(),
            imageUrl: entry.imageUrl,
            notes: entry.notes.trim() || null,
          })),
      )
      onClose()
      return
    }

    for (const entry of entries) {
      const levelLabel = entry.levelLabel.trim()
      const hasContent = entry.persisted || entry.notes.trim() || entry.imageUrl
      if (!hasContent) continue
      if (!levelLabel) {
        alert('Every tree needs a level label before saving.')
        return
      }

      await window.haga.savePassiveTreeSlot(build.id, {
        slotIndex: entry.slotIndex,
        levelLabel,
        notes: entry.notes.trim() || null,
      })
    }
    onClose()
  }

  const canAddMore = entries.length < MAX_PASSIVE_TREES

  return (
    <EditorOverlayFrame title="Edit Passive Tree" onClose={onClose}>
      <p className="text-xs text-slate-400">
        Add up to {MAX_PASSIVE_TREES} passive tree screenshots. Name each one with the level you want (e.g. Level 12,
        Level 45). Images stay on your computer.
      </p>

      {entries.length === 0 && (
        <p className="rounded border border-dashed border-slate-600 p-4 text-center text-sm text-slate-400">
          No trees yet. Add one and set its level.
        </p>
      )}

      {entries.map((entry, index) => (
        <div key={entry.clientId} className="space-y-2 rounded border border-slate-700 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tree {index + 1}</div>
            <button
              type="button"
              className="btn-ghost text-xs text-red-300"
              disabled={busySlot === entry.slotIndex}
              onClick={() => deleteTree(entry)}
            >
              Remove
            </button>
          </div>
          <input
            placeholder="Level label (e.g. Level 45)"
            value={entry.levelLabel}
            onChange={(e) => updateEntry(entry.clientId, { levelLabel: e.target.value })}
            className="w-full"
          />
          <textarea
            placeholder="Notes (optional)"
            value={entry.notes}
            onChange={(e) => updateEntry(entry.clientId, { notes: e.target.value })}
            className="w-full"
            rows={2}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary text-xs"
              disabled={busySlot === entry.slotIndex}
              onClick={() => uploadImage(entry)}
            >
              {entry.imageUrl ? 'Replace image' : 'Choose image'}
            </button>
            {entry.imageUrl && (
              <button
                type="button"
                className="btn-ghost text-xs"
                disabled={busySlot === entry.slotIndex}
                onClick={() => removeImage(entry)}
              >
                Remove image
              </button>
            )}
          </div>

          {entry.imageUrl && (
            <PassiveTreeImage
              imageUrl={entry.imageUrl}
              alt={`Preview ${entry.levelLabel || 'passive tree'}`}
              className="passive-tree-image passive-tree-image--preview"
            />
          )}
        </div>
      ))}

      {canAddMore && (
        <button type="button" className="btn-ghost w-full text-sm" onClick={addTree}>
          + Add tree ({entries.length}/{MAX_PASSIVE_TREES})
        </button>
      )}

      <button type="button" className="btn-primary w-full" onClick={saveTrees}>
        Save trees
      </button>
    </EditorOverlayFrame>
  )
}
