import { useState } from 'react'
import type { PassiveTreeSlot } from '../types/build'
import { PassiveTreeImage } from './PassiveTreeImage'

interface Props {
  trees: PassiveTreeSlot[]
  onEdit: () => void
}

export function TreeTab({ trees, onEdit }: Props) {
  const [index, setIndex] = useState(0)
  const slot = trees[index]

  if (trees.length === 0) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-slate-400">
          No passive tree images yet. Use <strong>Edit tree</strong> to add up to 3 trees with your own level labels.
        </p>
        <button type="button" className="btn-tree-edit" onClick={onEdit}>
          Edit tree
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {trees.map((t, i) => (
            <button
              key={t.id}
              type="button"
              className={`btn-ghost text-xs ${i === index ? 'border-amber-500 text-amber-300' : ''}`}
              onClick={() => setIndex(i)}
            >
              {t.levelLabel}
            </button>
          ))}
        </div>
        <button type="button" className="btn-tree-edit shrink-0" onClick={onEdit}>
          Edit tree
        </button>
      </div>

      {slot?.imageUrl ? (
        <PassiveTreeImage imageUrl={slot.imageUrl} alt={`Passive tree ${slot.levelLabel}`} />
      ) : (
        <div className="rounded-md border border-dashed border-slate-600 p-6 text-center text-slate-400">
          No image for this slot yet. Open <strong>Edit tree</strong> and upload a screenshot.
        </div>
      )}

      {slot?.notes && <p className="text-xs text-slate-400">{slot.notes}</p>}
    </div>
  )
}
