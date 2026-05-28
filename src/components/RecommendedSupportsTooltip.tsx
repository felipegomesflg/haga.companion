import type { ReactNode } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RecommendedSupportGem } from '../types/build'
import { gemColorTextClass } from '../lib/gemColors'

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

export interface GemDetailInfo {
  requiredLevel: number
  tags: string[]
  supports?: RecommendedSupportGem[]
}

interface PortalProps {
  detail: GemDetailInfo
  anchorRect: DOMRect
}

function GemDetailTooltipPortal({ detail, anchorRect }: PortalProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const supports = detail.supports ?? []
  const tags = detail.tags

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setPosition(clampTooltipPosition(anchorRect, width, height))
  }, [anchorRect, detail.requiredLevel, tags.length, supports.length])

  return createPortal(
    <div
      ref={ref}
      className="gem-detail-tooltip"
      role="tooltip"
      style={{
        position: 'fixed',
        left: position?.left ?? anchorRect.left,
        top: position?.top ?? anchorRect.top,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      <div className="gem-detail-tooltip__row">
        <span className="gem-detail-tooltip__tag gem-detail-tooltip__tag--level">
          Level {detail.requiredLevel}
        </span>
      </div>

      {tags.length > 0 && (
        <div className="gem-detail-tooltip__row">
          {tags.map((tag) => (
            <span key={tag} className="gem-detail-tooltip__tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {supports.length > 0 && (
        <div className="gem-detail-tooltip__row">
          {supports.map((gem) => (
            <span
              key={gem.gemId}
              className={`gem-detail-tooltip__tag gem-detail-tooltip__tag--gem ${gemColorTextClass(gem.color)}`.trim()}
            >
              {gem.gemName}
            </span>
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}

interface HoverProps {
  detail: GemDetailInfo | null | undefined
  children: ReactNode
  className?: string
}

export function GemDetailHover({ detail, children, className = '' }: HoverProps) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  if (!detail) {
    return <span className={className}>{children}</span>
  }

  return (
    <span
      ref={anchorRef}
      className={`gem-detail-hover ${className}`.trim()}
      onMouseEnter={() => {
        if (anchorRef.current) setAnchorRect(anchorRef.current.getBoundingClientRect())
      }}
      onMouseLeave={() => setAnchorRect(null)}
    >
      {children}
      {anchorRect && <GemDetailTooltipPortal detail={detail} anchorRect={anchorRect} />}
    </span>
  )
}

/** @deprecated Use GemDetailHover */
export function RecommendedSupportsHover({
  supports,
  children,
  className = '',
}: {
  supports: RecommendedSupportGem[]
  children: ReactNode
  className?: string
}) {
  if (supports.length === 0) {
    return <span className={className}>{children}</span>
  }

  return (
    <GemDetailHover detail={{ requiredLevel: 1, tags: [], supports }} className={className}>
      {children}
    </GemDetailHover>
  )
}
