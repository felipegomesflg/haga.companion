import { useEffect, useRef, useState } from 'react'
import type { BuildGemGroup } from '../types/build'
import { useI18n } from '../hooks/useI18n'
import type { DraftGemPage } from '../lib/gemPages'
import { EditablePageBar } from './EditablePageBar'
import { GemLevelLock } from './GemLevelLock'
import { GemDetailHover } from './RecommendedSupportsTooltip'
import { getGemRequiredLevel, isGemAtCurrentLevel } from '../lib/gemLevel'

interface Props {
  pages: DraftGemPage[]
  groups: BuildGemGroup[]
  characterLevel: number | null
  autoEditPageId?: string | null
  onAutoEditPageDone?: () => void
  onSelectPage: (pageId: string) => void
  onAddPage: () => void
  onRenamePage: (pageId: string, title: string) => void
  onDeletePage: (pageId: string) => void
  onAddGroup: () => void
  onRenameGroupLabel: (groupId: string, label: string) => void
  onEditGroup: (groupId: string) => void
  onDeleteGroup: (groupId: string) => void
}

export function GemsTab({
  pages,
  groups,
  characterLevel,
  autoEditPageId,
  onAutoEditPageDone,
  onSelectPage,
  onAddPage,
  onRenamePage,
  onDeletePage,
  onAddGroup,
  onRenameGroupLabel,
  onEditGroup,
  onDeleteGroup,
}: Props) {
  const { t } = useI18n()

  return (
    <div className="space-y-4 text-sm">
      <EditablePageBar
        pages={pages}
        autoEditPageId={autoEditPageId}
        onAutoEditDone={onAutoEditPageDone}
        onSelectPage={onSelectPage}
        onAddPage={onAddPage}
        onRenamePage={onRenamePage}
        onDeletePage={onDeletePage}
        ariaLabel="Gem pages"
        labels={{
          addPage: t.build.gems.addPage,
          deletePage: t.common.delete,
          activeHint: t.build.gems.activePageHint,
          deleteConfirm: t.build.gems.deletePageConfirm,
          renameTabHint: t.build.gems.renameTabHint,
        }}
      />

      {characterLevel !== null && (
        <div className="text-xs text-slate-400">
          {t.build.gems.characterLevel.replace('{level}', String(characterLevel))}
        </div>
      )}

      <div className="flex justify-end">
        <button type="button" className="btn-primary text-xs" onClick={onAddGroup}>
          {t.build.gems.addGroup}
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="text-slate-400">{t.build.gems.noGroups}</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <GemGroupCard
              key={group.id}
              group={group}
              characterLevel={characterLevel}
              onRenameLabel={(label) => onRenameGroupLabel(group.id, label)}
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
  onRenameLabel,
  onEdit,
  onDelete,
}: {
  group: BuildGemGroup
  characterLevel: number | null
  onRenameLabel: (label: string) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useI18n()
  const [collapsed, setCollapsed] = useState(false)
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(group.notes ?? '')
  const ignoreLabelBlurRef = useRef(false)
  const labelInputRef = useRef<HTMLInputElement>(null)
  const main = group.mainGem
  const mainAtCurrentLevel = main ? isGemAtCurrentLevel(main.craftingLevel, characterLevel) : false
  const placeholderLabel = group.notes?.trim() || t.build.gems.emptyGroup

  useEffect(() => {
    if (!editingLabel) return
    ignoreLabelBlurRef.current = true
    const focusTimer = window.setTimeout(() => {
      labelInputRef.current?.focus()
      labelInputRef.current?.select()
      window.setTimeout(() => {
        ignoreLabelBlurRef.current = false
      }, 100)
    }, 0)
    return () => window.clearTimeout(focusTimer)
  }, [editingLabel])

  const commitLabel = () => {
    setEditingLabel(false)
    onRenameLabel(labelDraft.trim() || placeholderLabel)
  }

  const startLabelEdit = () => {
    setLabelDraft(group.notes ?? placeholderLabel)
    setEditingLabel(true)
  }

  return (
    <section className="gem-group-card">
      <div className="gem-group-card__header">
        <button type="button" className="gem-group-card__collapse" onClick={() => setCollapsed((v) => !v)} aria-expanded={!collapsed}>
          {collapsed ? '▸' : '▾'}
        </button>
        <div className="min-w-0 flex-1">
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
              <GemLevelLock
                name={main.gemName}
                color={main.color}
                unknown={main.isUnknown}
                craftingLevel={main.craftingLevel}
                characterLevel={characterLevel}
                variant="border"
                className={`font-medium ${mainAtCurrentLevel ? 'gem-at-level--highlight' : ''}`.trim()}
              />
            </GemDetailHover>
          ) : editingLabel ? (
            <input
              ref={labelInputRef}
              className="gem-group-card__label-input w-full"
              value={labelDraft}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setLabelDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  ignoreLabelBlurRef.current = true
                  commitLabel()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  ignoreLabelBlurRef.current = true
                  setEditingLabel(false)
                  setLabelDraft(group.notes ?? '')
                }
              }}
              onBlur={() => {
                if (ignoreLabelBlurRef.current) return
                commitLabel()
              }}
            />
          ) : (
            <button
              type="button"
              className="font-medium text-slate-100 hover:text-amber-200"
              onMouseDown={(e) => {
                e.preventDefault()
                startLabelEdit()
              }}
              title={t.build.gems.renameGroupHint}
            >
              {placeholderLabel}
            </button>
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
            {t.common.edit}
          </button>
          <button type="button" className="btn-ghost text-xs text-red-300" onClick={onDelete}>
            {t.common.delete}
          </button>
        </div>
      </div>

      {!collapsed && group.linkedGems.length > 0 && (
        <ul className="gem-group-card__linked">
          {group.linkedGems.map((gem) => {
            const atCurrentLevel = isGemAtCurrentLevel(gem.craftingLevel, characterLevel)
            return (
            <li key={gem.id} className="gem-group-card__linked-item">
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
                  variant="border"
                  className={atCurrentLevel ? 'gem-at-level--highlight' : ''}
                />
              </GemDetailHover>
              <span className="text-xs text-slate-500">{gem.gemType}</span>
            </li>
            )
          })}
        </ul>
      )}

      {!collapsed && main && group.notes?.trim() && <p className="gem-group-card__notes">{group.notes.trim()}</p>}
    </section>
  )
}
