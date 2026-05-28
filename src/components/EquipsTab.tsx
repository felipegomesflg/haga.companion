import type { BudgetTier, BuildItem } from '../types/build'
import { EquipmentPaperdoll } from './EquipmentPaperdoll'
import type { EquipmentSlotId } from '../lib/equipmentSlots'

const BUDGET_LABELS: Record<BudgetTier, string> = {
  early: 'Early Budget',
  medium: 'Medium Budget',
  high: 'High Budget',
}

interface Props {
  items: BuildItem[]
  budgetTier: BudgetTier
  onBudgetChange: (tier: BudgetTier) => void
  onEditSlot: (slotId: EquipmentSlotId, item: BuildItem | null) => void
}

export function EquipsTab({ items, budgetTier, onBudgetChange, onEditSlot }: Props) {
  return (
    <div className="space-y-4 text-sm">
      <label className="flex items-center gap-2">
        <span className="text-slate-400">Budget:</span>
        <select
          value={budgetTier}
          onChange={(e) => onBudgetChange(e.target.value as BudgetTier)}
          className="flex-1"
        >
          {(Object.keys(BUDGET_LABELS) as BudgetTier[]).map((tier) => (
            <option key={tier} value={tier}>
              {BUDGET_LABELS[tier]}
            </option>
          ))}
        </select>
      </label>

      <p className="text-center text-xs text-slate-500">
        Click a slot to assign gear · Right-click an item to pin its details
      </p>

      <EquipmentPaperdoll items={items} onEditSlot={onEditSlot} />
    </div>
  )
}
