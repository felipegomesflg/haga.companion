import { useState } from 'react'

interface Props {
  onImport: (code: string) => Promise<void>
}

export function PobImportStrip({ onImport }: Props) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const importBuild = async () => {
    if (!code.trim() || busy) return

    setBusy(true)
    try {
      await onImport(code)
      setCode('')
    } catch {
      // silent
    } finally {
      setBusy(false)
    }
  }

  const decodeAndCopy = async () => {
    if (!code.trim() || busy) return

    setBusy(true)
    try {
      const xml = await window.haga.decodePoBShareCode(code)
      await navigator.clipboard.writeText(xml)
    } catch {
      // silent
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pob-import-strip">
      <button
        type="button"
        className="pob-import-strip__toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>PoB import</span>
        <span className="pob-import-strip__chevron">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="pob-import-strip__body">
          <textarea
            className="pob-import-strip__input"
            placeholder="Paste Path of Building share code…"
            value={code}
            disabled={busy}
            onChange={(e) => setCode(e.target.value)}
            rows={2}
          />
          <div className="pob-import-strip__actions">
            <button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => void importBuild()}>
              {busy ? 'Importing…' : 'Import to draft'}
            </button>
            <button type="button" className="btn-ghost text-xs" disabled={busy} onClick={() => void decodeAndCopy()}>
              Decode XML
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
