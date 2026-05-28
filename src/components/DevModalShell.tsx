import type { ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

export function DevModalShell({ title, onClose, children }: Props) {
  return (
    <div className="dev-modal">
      <header className="dev-modal__header">
        <h1 className="dev-modal__title">{title}</h1>
        <button type="button" className="dev-modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <div className="dev-modal__body">{children}</div>
    </div>
  )
}
