import type { ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

export function EditorOverlayFrame({ title, onClose, children }: Props) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
      <div className="overlay-panel flex max-h-[95%] w-full max-w-lg flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" className="btn-ghost text-xs" onClick={onClose}>
            Cancel
          </button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">{children}</div>
      </div>
    </div>
  )
}
