import { useEffect, useState } from 'react'
import type { BuildItem } from '../types/build'
import { type EquipmentSlotId, getSlotDef, normalizeSlotId } from '../lib/equipmentSlots'
import { getBuildItemDisplayName } from '../lib/buildItemDisplay'
import { EquipItemTooltipPinned, EquipItemTooltipPortal } from './EquipItemTooltip'
import { ItemIcon } from './ItemIcon'

function itemsBySlot(items: BuildItem[]): Map<EquipmentSlotId, BuildItem> {
  const map = new Map<EquipmentSlotId, BuildItem>()
  for (const item of items) {
    const slotId = normalizeSlotId(item.slotLabel)
    if (slotId) map.set(slotId, item)
  }
  return map
}

function isTwoHandedMain(items: BuildItem[]): boolean {
  const main = itemsBySlot(items).get('weapon_main')
  return Boolean(main?.isTwoHanded)
}

interface SlotCellProps {
  slotId: EquipmentSlotId
  item: BuildItem | null
  disabled?: boolean
  mirrored?: boolean
  pinnedItemId: string | null
  onEdit: (slotId: EquipmentSlotId, item: BuildItem | null) => void
  onShowTooltip: (item: BuildItem, anchor: HTMLElement) => void
  onHideTooltip: () => void
  onPinItem: (item: BuildItem) => void
}

function SlotCell({
  slotId,
  item,
  disabled,
  mirrored,
  pinnedItemId,
  onEdit,
  onShowTooltip,
  onHideTooltip,
  onPinItem,
}: SlotCellProps) {
  const def = getSlotDef(slotId)
  const isWeapon = slotId === 'weapon_main' || slotId === 'weapon_off'

  return (
    <div className={`equip-slot-wrap equip-slot-wrap--${def.area} ${isWeapon ? 'equip-slot-wrap--weapon' : ''}`}>
      <button
        type="button"
        disabled={disabled}
        className={`equip-slot ${disabled ? 'equip-slot--disabled' : ''} ${mirrored ? 'equip-slot--mirrored' : ''} ${item && pinnedItemId === item.id ? 'equip-slot--pinned' : ''}`}
        onClick={() => !disabled && onEdit(slotId, item)}
        onContextMenu={(e) => {
          if (!item || disabled) return
          e.preventDefault()
          onPinItem(item)
          onHideTooltip()
        }}
        onMouseEnter={(e) => {
          if (item && item.id !== pinnedItemId) onShowTooltip(item, e.currentTarget)
        }}
        onMouseLeave={onHideTooltip}
        onFocus={(e) => {
          if (item && item.id !== pinnedItemId) onShowTooltip(item, e.currentTarget)
        }}
        onBlur={onHideTooltip}
        title={item ? undefined : disabled ? 'Occupied by two-handed weapon' : `${def.label} — click to edit`}
      >
        <span className="equip-slot__label">{def.shortLabel}</span>
        {item ? (
          <>
            <ItemIcon item={item} size={22} className="equip-slot__icon" />
            <span className="equip-slot__item">{getBuildItemDisplayName(item)}</span>
          </>
        ) : (
          <span className="equip-slot__empty">+</span>
        )}
      </button>
    </div>
  )
}

interface Props {
  items: BuildItem[]
  onEditSlot: (slotId: EquipmentSlotId, item: BuildItem | null) => void
}

export function EquipmentPaperdoll({ items, onEditSlot }: Props) {
  const bySlot = itemsBySlot(items)
  const mainWeapon = bySlot.get('weapon_main') ?? null
  const offHand = bySlot.get('weapon_off') ?? null
  const twoHand = isTwoHandedMain(items)
  const [hoverTooltip, setHoverTooltip] = useState<{ item: BuildItem; anchorRect: DOMRect } | null>(null)
  const [pinnedItem, setPinnedItem] = useState<BuildItem | null>(null)

  useEffect(() => {
    if (pinnedItem && !items.some((entry) => entry.id === pinnedItem.id)) {
      setPinnedItem(null)
    }
  }, [items, pinnedItem])

  const showTooltip = (item: BuildItem, anchor: HTMLElement) => {
    setHoverTooltip({ item, anchorRect: anchor.getBoundingClientRect() })
  }

  const hideTooltip = () => setHoverTooltip(null)

  const pinItem = (item: BuildItem) => setPinnedItem(item)

  const slotProps = {
    pinnedItemId: pinnedItem?.id ?? null,
    onShowTooltip: showTooltip,
    onHideTooltip: hideTooltip,
    onPinItem: pinItem,
    onEdit: onEditSlot,
  }

  return (
    <>
      <div className="equipment-paperdoll-wrap">
        <div className="equipment-paperdoll">
          <SlotCell slotId="weapon_main" item={mainWeapon} {...slotProps} />
          <SlotCell slotId="ring_left" item={bySlot.get('ring_left') ?? null} {...slotProps} />
          <SlotCell slotId="gloves" item={bySlot.get('gloves') ?? null} {...slotProps} />
          <SlotCell slotId="helmet" item={bySlot.get('helmet') ?? null} {...slotProps} />
          <SlotCell slotId="body_armour" item={bySlot.get('body_armour') ?? null} {...slotProps} />
          <SlotCell slotId="belt" item={bySlot.get('belt') ?? null} {...slotProps} />
          <SlotCell slotId="amulet" item={bySlot.get('amulet') ?? null} {...slotProps} />
          <SlotCell slotId="ring_right" item={bySlot.get('ring_right') ?? null} {...slotProps} />
          <SlotCell slotId="boots" item={bySlot.get('boots') ?? null} {...slotProps} />
          <SlotCell
            slotId="weapon_off"
            item={twoHand ? mainWeapon : offHand}
            disabled={twoHand}
            mirrored={twoHand && Boolean(mainWeapon)}
            {...slotProps}
          />
        </div>
        {pinnedItem && <EquipItemTooltipPinned item={pinnedItem} />}
      </div>
      {hoverTooltip && <EquipItemTooltipPortal item={hoverTooltip.item} anchorRect={hoverTooltip.anchorRect} />}
    </>
  )
}
