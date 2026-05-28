import { useEffect, useMemo, useState } from 'react'
import type { BuildGemGroup } from '../types/build'
import { GemName } from './GemName'
import { GemLevelLock } from './GemLevelLock'
import { GemDetailHover } from './RecommendedSupportsTooltip'
import { gemColorBorderClass } from '../lib/gemColors'
import { getGemRequiredLevel, isGemAtCurrentLevel } from '../lib/gemLevel'

interface Props {
  groups: BuildGemGroup[]
  characterLevel: number | null
  onAddGroup: () => void
  onEditGroup: (groupId: string) => void
  onDeleteGroup: (groupId: string) => void
}

export function GemsTab({ groups, characterLevel, onAddGroup, onEditGroup, onDeleteGroup }: Props) {
  return (
    <div className="space-y-4 text-sm">
      {characterLevel !== null && (
        <div className="text-xs text-slate-400">
          Character level: {characterLevel}
        </div>
      )}

      <div className="flex justify-end">
        <button type="button" className="btn-primary text-xs" onClick={onAddGroup}>
          Add gem group
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="text-slate-400">No gem groups yet. Add a group with one main gem (active or spirit) and up to 5 linked gems.</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <GemGroupCard
              key={group.id}
              group={group}
              characterLevel={characterLevel}
              onEdit={() => onEditGroup(group.id)}
              onDelete={() => onDeleteGroup(group.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GemGroupCard({
  group,
  characterLevel,
  onEdit,
  onDelete,
}: {
  group: BuildGemGroup
  characterLevel: number | null
  onEdit: () => void
  onDelete: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const main = group.mainGem
  const mainAtCurrentLevel = main ? isGemAtCurrentLevel(main.craftingLevel, characterLevel) : false

  return (
    <section className="gem-group-card">
      <div className="gem-group-card__header">
        <button type="button" className="gem-group-card__collapse" onClick={() => setCollapsed((v) => !v)} aria-expanded={!collapsed}>
          {collapsed ? '▸' : '▾'}
        </button>
        <div className={`min-w-0 flex-1 ${mainAtCurrentLevel ? 'gem-at-level--current' : ''}`.trim()}>
          {main ? (
            <GemDetailHover
              detail={{
                requiredLevel: getGemRequiredLevel(main.craftingLevel),
                tags: main.tags,
                supports:
                  main.gemType === 'active' || main.gemType === 'spirit' ? group.recommendedSupports : [],
              }}
              className="block"
            >
              <div
                className={`font-medium ${main.isUnknown ? 'gem-border--unknown' : gemColorBorderClass(main.color)} gem-name--bordered`}
              >
                <GemLevelLock
                  name={main.gemName}
                  color={main.color}
                  unknown={main.isUnknown}
                  craftingLevel={main.craftingLevel}
                  characterLevel={characterLevel}
                  variant="border"
                />
              </div>
            </GemDetailHover>
          ) : (
            <div className="font-medium text-slate-100">Empty group</div>
          )}
          {main && (
            <div className="text-xs text-slate-400">
              Main · {main.gemType}
              {group.linkedGems.length > 0 && ` · ${group.linkedGems.length} linked`}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" className="btn-ghost text-xs" onClick={onEdit}>
            Edit
          </button>
          <button type="button" className="btn-ghost text-xs text-red-300" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      {!collapsed && group.linkedGems.length > 0 && (
        <ul className="gem-group-card__linked">
          {group.linkedGems.map((gem) => {
            const atCurrentLevel = isGemAtCurrentLevel(gem.craftingLevel, characterLevel)
            return (
            <li
              key={gem.id}
              className={`gem-group-card__linked-item ${gem.isUnknown ? 'gem-border--unknown' : gemColorBorderClass(gem.color)} ${atCurrentLevel ? 'gem-at-level--current' : ''}`.trim()}
            >
              <GemDetailHover
                detail={{
                  requiredLevel: getGemRequiredLevel(gem.craftingLevel),
                  tags: gem.tags,
                }}
              >
                <GemLevelLock
                  name={gem.gemName}
                  color={gem.color}
                  unknown={gem.isUnknown}
                  craftingLevel={gem.craftingLevel}
                  characterLevel={characterLevel}
                />
              </GemDetailHover>
              <span className="text-xs text-slate-500">{gem.gemType}</span>
            </li>
            )
          })}
        </ul>
      )}

      {!collapsed && group.notes?.trim() && <p className="gem-group-card__notes">{group.notes.trim()}</p>}
    </section>
  )
}
