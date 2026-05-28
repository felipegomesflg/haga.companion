import type { ReactNode } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getGemRequiredLevel, isGemLocked } from '../lib/gemLevel'
import { GemName } from './GemName'

const VIEWPORT_PAD = 8
const GAP = 8

function clampTooltipPosition(anchor: DOMRect, width: number, height: number): { left: number; top: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight

  let left = anchor.right + GAP
  if (left + width > vw - VIEWPORT_PAD) {
    left = anchor.left - width - GAP
  }
  if (left < VIEWPORT_PAD) {
    left = Math.max(VIEWPORT_PAD, vw - VIEWPORT_PAD - width)
  }

  let top = anchor.top + anchor.height / 2 - height / 2
  top = Math.max(VIEWPORT_PAD, Math.min(top, vh - VIEWPORT_PAD - height))

  return { left, top }
}

interface Props {
  name: string
  color: string | null | undefined
  unknown?: boolean
  craftingLevel: number | null | undefined
  characterLevel: number | null | undefined
  variant?: 'text' | 'border'
  className?: string
  children?: ReactNode
}

function GemLevelLockTooltipPortal({
  anchorRect,
  gemName,
  requiredLevel,
  characterLevel,
}: {
  anchorRect: DOMRect
  gemName: string
  requiredLevel: number
  characterLevel: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setPosition(clampTooltipPosition(anchorRect, width, height))
  }, [anchorRect, gemName, requiredLevel, characterLevel])

  return createPortal(
    <div
      ref={ref}
      className="gem-level-lock-tooltip"
      role="tooltip"
      style={{
        position: 'fixed',
        left: position?.left ?? anchorRect.left,
        top: position?.top ?? anchorRect.top,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      <div className="gem-level-lock-tooltip__title">Level required</div>
      <p className="gem-level-lock-tooltip__body">
        <strong>{gemName}</strong> requires level {requiredLevel}. You are level {characterLevel}.
      </p>
    </div>,
    document.body,
  )
}

export function GemLevelLock({
  name,
  color,
  unknown = false,
  craftingLevel,
  characterLevel,
  variant = 'text',
  className = '',
  children,
}: Props) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const locked = isGemLocked(characterLevel, craftingLevel)
  const requiredLevel = getGemRequiredLevel(craftingLevel)

  const content = children ?? (
    <GemName name={name} color={color} unknown={unknown} variant={variant} className={className} />
  )

  return (
    <span
      ref={anchorRef}
      className={`gem-level-lock ${locked ? 'gem-level-lock--locked' : ''}`.trim()}
      onMouseEnter={() => {
        if (locked && anchorRef.current) setAnchorRect(anchorRef.current.getBoundingClientRect())
      }}
      onMouseLeave={() => setAnchorRect(null)}
    >
      {content}
      {locked && anchorRect && characterLevel != null && (
        <GemLevelLockTooltipPortal
          anchorRect={anchorRect}
          gemName={name}
          requiredLevel={requiredLevel}
          characterLevel={characterLevel}
        />
      )}
    </span>
  )
}
