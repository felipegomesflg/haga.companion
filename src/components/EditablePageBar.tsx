import { useEffect, useRef, useState } from 'react'

export interface EditablePageTab {
  id: string
  title: string
  isActive: boolean
}

interface Props {
  pages: EditablePageTab[]
  autoEditPageId?: string | null
  onAutoEditDone?: () => void
  onSelectPage: (pageId: string) => void
  onAddPage: () => void
  onRenamePage: (pageId: string, title: string) => void
  onDeletePage: (pageId: string) => void
  ariaLabel: string
  labels: {
    addPage: string
    deletePage: string
    activeHint: string
    deleteConfirm: string
    renameTabHint: string
  }
}

function PageTabInput({
  initialTitle,
  isActive,
  onCommit,
  onCancel,
}: {
  initialTitle: string
  isActive: boolean
  onCommit: (title: string) => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(initialTitle)
  const ignoreBlurRef = useRef(true)

  useEffect(() => {
    setDraft(initialTitle)
    ignoreBlurRef.current = true

    const focusTimer = window.setTimeout(() => {
      const input = inputRef.current
      input?.focus()
      input?.select()
      window.setTimeout(() => {
        ignoreBlurRef.current = false
      }, 100)
    }, 0)

    return () => window.clearTimeout(focusTimer)
  }, [initialTitle])

  const commit = () => {
    const trimmed = draft.trim()
    onCommit(trimmed || initialTitle)
  }

  return (
    <input
      ref={inputRef}
      type="text"
      className={`gem-page-bar__tab-input ${isActive ? 'gem-page-bar__tab-input--active' : ''}`}
      value={draft}
      autoComplete="off"
      spellCheck={false}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          ignoreBlurRef.current = true
          commit()
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          ignoreBlurRef.current = true
          onCancel()
        }
      }}
      onBlur={() => {
        if (ignoreBlurRef.current) return
        commit()
      }}
      onMouseDown={(e) => e.stopPropagation()}
    />
  )
}

export function EditablePageBar({
  pages,
  autoEditPageId,
  onAutoEditDone,
  onSelectPage,
  onAddPage,
  onRenamePage,
  onDeletePage,
  ariaLabel,
  labels,
}: Props) {
  const [editingPageId, setEditingPageId] = useState<string | null>(null)

  useEffect(() => {
    if (!autoEditPageId) return
    setEditingPageId(autoEditPageId)
    onAutoEditDone?.()
  }, [autoEditPageId]) // eslint-disable-line react-hooks/exhaustive-deps

  const activePage = pages.find((p) => p.isActive) ?? pages[0]

  const startEdit = (pageId: string) => {
    setEditingPageId(pageId)
  }

  const commitEdit = (pageId: string, title: string) => {
    setEditingPageId(null)
    const page = pages.find((p) => p.id === pageId)
    if (!page || page.title === title) return
    onRenamePage(pageId, title)
  }

  const cancelEdit = () => {
    setEditingPageId(null)
  }

  return (
    <div className="gem-page-bar">
      <div className="gem-page-bar__tabs" role="tablist" aria-label={ariaLabel}>
        {pages.map((page) =>
          editingPageId === page.id ? (
            <PageTabInput
              key={page.id}
              initialTitle={page.title}
              isActive={page.isActive}
              onCommit={(title) => commitEdit(page.id, title)}
              onCancel={cancelEdit}
            />
          ) : (
            <button
              key={page.id}
              type="button"
              role="tab"
              aria-selected={page.isActive}
              className={`gem-page-bar__tab ${page.isActive ? 'gem-page-bar__tab--active' : ''}`}
              onMouseDown={(e) => {
                if (page.isActive) {
                  e.preventDefault()
                  startEdit(page.id)
                }
              }}
              onClick={() => {
                if (!page.isActive) {
                  onSelectPage(page.id)
                }
              }}
              title={labels.renameTabHint}
            >
              {page.title}
            </button>
          ),
        )}
        <button type="button" className="gem-page-bar__add" onClick={onAddPage} title={labels.addPage}>
          +
        </button>
      </div>

      {activePage && (
        <div className="gem-page-bar__actions">
          <span className="gem-page-bar__hint text-xs text-slate-400">{labels.activeHint}</span>
          {pages.length > 1 && (
            <button
              type="button"
              className="btn-ghost text-xs text-red-300"
              onClick={() => {
                if (confirm(labels.deleteConfirm)) onDeletePage(activePage.id)
              }}
            >
              {labels.deletePage}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
