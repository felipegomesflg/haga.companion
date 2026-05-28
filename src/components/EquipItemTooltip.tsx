import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { BuildItem } from '../types/build'
import { getBuildItemDisplayName, getBuildItemTooltipMods } from '../lib/buildItemDisplay'
import { ItemIcon } from './ItemIcon'
import { PoBNotesDisplay } from './PoBNotesDisplay'

const VIEWPORT_PAD = 8
const GAP = 8

function clampTooltipPosition(anchor: DOMRect, width: number, height: number): { left: number; top: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight

  let left = anchor.left - width - GAP
  if (left < VIEWPORT_PAD) {
    left = anchor.right + GAP
  }
  if (left + width > vw - VIEWPORT_PAD) {
    left = Math.max(VIEWPORT_PAD, vw - VIEWPORT_PAD - width)
  }

  let top = anchor.top + anchor.height / 2 - height / 2
  top = Math.max(VIEWPORT_PAD, Math.min(top, vh - VIEWPORT_PAD - height))

  return { left, top }
}

export function EquipItemTooltipContent({ item }: { item: BuildItem }) {
  const mods = getBuildItemTooltipMods(item)
  const isUnique = item.rarity === 'unique'

  return (
    <>
      <div className="equip-item-tooltip__header">
        <ItemIcon item={item} size={40} className="equip-item-tooltip__icon" />
        <div
          className={`equip-item-tooltip__title ${isUnique ? 'equip-item-tooltip__title--unique' : 'equip-item-tooltip__title--rare'}`}
        >
          {getBuildItemDisplayName(item)}
        </div>
      </div>
      {mods.length > 0 && (
        <ul className="equip-item-tooltip__mods">
          {mods.map((text, i) => (
            <li key={`${text}-${i}`}>{text}</li>
          ))}
        </ul>
      )}
      {item.notes?.trim() &&
        (item.notes.includes('[green]') ? (
          <PoBNotesDisplay notes={item.notes} />
        ) : (
          <div className="equip-item-tooltip__notes">{item.notes.trim()}</div>
        ))}
    </>
  )
}

interface PortalProps {
  item: BuildItem
  anchorRect: DOMRect
}

export function EquipItemTooltipPortal({ item, anchorRect }: PortalProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const mods = getBuildItemTooltipMods(item)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setPosition(clampTooltipPosition(anchorRect, width, height))
  }, [item, anchorRect, mods.length, item.notes])

  return createPortal(
    <div
      ref={ref}
      className="equip-item-tooltip equip-item-tooltip--hover"
      role="tooltip"
      style={{
        position: 'fixed',
        left: position?.left ?? anchorRect.left,
        top: position?.top ?? anchorRect.top,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      <EquipItemTooltipContent item={item} />
    </div>,
    document.body,
  )
}

export function EquipItemTooltipPinned({ item }: { item: BuildItem }) {
  return (
    <div className="equip-item-tooltip equip-item-tooltip--pinned" role="region" aria-label="Pinned item details">
      <EquipItemTooltipContent item={item} />
    </div>
  )
}
