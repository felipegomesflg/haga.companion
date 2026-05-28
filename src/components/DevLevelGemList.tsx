import { useMemo, useState } from 'react'
import type { BuildGemGroup, BuildGemLink } from '../types/build'
import { GemLevelLock } from './GemLevelLock'
import { gemColorBorderClass } from '../lib/gemColors'
import { getGemRequiredLevel, isGemAtCurrentLevel } from '../lib/gemLevel'

interface Props {
  groups: BuildGemGroup[]
  characterLevel: number | null
}

function GemLevelBadge({ gem, highlighted }: { gem: BuildGemLink; highlighted?: boolean }) {
  const level = getGemRequiredLevel(gem.craftingLevel)
  return (
    <span
      className={`dev-level-gem-list__level ${highlighted ? 'gem-at-level-badge--current' : ''}`.trim()}
    >
      Lv {level}
    </span>
  )
}

function GemRow({
  gem,
  characterLevel,
  variant = 'text',
}: {
  gem: BuildGemLink
  characterLevel: number | null
  variant?: 'text' | 'border'
}) {
  const atCurrentLevel = isGemAtCurrentLevel(gem.craftingLevel, characterLevel)

  return (
    <div className={`dev-level-gem-list__row ${atCurrentLevel ? 'gem-at-level--current' : ''}`.trim()}>
      <div
        className={`dev-level-gem-list__gem ${gem.isUnknown ? 'gem-border--unknown' : gemColorBorderClass(gem.color)} ${variant === 'border' ? 'gem-name--bordered' : ''}`.trim()}
      >
        <GemLevelLock
          name={gem.gemName}
          color={gem.color}
          unknown={gem.isUnknown}
          craftingLevel={gem.craftingLevel}
          characterLevel={characterLevel}
          variant={variant}
        />
      </div>
      <GemLevelBadge gem={gem} highlighted={atCurrentLevel} />
    </div>
  )
}

function DevLevelGemGroup({
  group,
  characterLevel,
}: {
  group: BuildGemGroup
  characterLevel: number | null
}) {
  const [collapsed, setCollapsed] = useState(false)
  const main = group.mainGem

  if (!main) return null

  return (
    <section className="gem-group-card dev-level-gem-list__group">
      <div className="gem-group-card__header">
        <button
          type="button"
          className="gem-group-card__collapse"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <div className="min-w-0 flex-1">
          <GemRow gem={main} characterLevel={characterLevel} variant="border" />
          <div className="text-xs text-slate-400">
            Main · {main.gemType}
            {group.linkedGems.length > 0 && ` · ${group.linkedGems.length} linked`}
          </div>
        </div>
      </div>

      {!collapsed && group.linkedGems.length > 0 && (
        <ul className="gem-group-card__linked dev-level-gem-list__linked">
          {group.linkedGems.map((gem) => (
            <li key={gem.id} className="gem-group-card__linked-item dev-level-gem-list__linked-item">
              <GemRow gem={gem} characterLevel={characterLevel} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function DevLevelGemList({ groups, characterLevel }: Props) {
  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.sortOrder - b.sortOrder),
    [groups],
  )

  if (sortedGroups.length === 0) {
    return <p className="dev-level-gem-list__empty">No gems in the active build.</p>
  }

  return (
    <div className="dev-level-gem-list">
      {sortedGroups.map((group) => (
        <DevLevelGemGroup key={group.id} group={group} characterLevel={characterLevel} />
      ))}
    </div>
  )
}
