import { useAutoResizeWindow } from '../hooks/useAutoResizeWindow'
import { useI18n } from '../hooks/useI18n'

export function AboutWindow() {
  const contentRef = useAutoResizeWindow()
  const { t } = useI18n()

  return (
    <div
      ref={contentRef}
      className="inline-flex w-max min-w-[360px] max-w-[720px] flex-col items-center bg-slate-950 p-6 text-center text-slate-100"
    >
      <img src="/logo.png" alt="HAGA" className="mb-4 h-32 w-32 object-contain" />
      <h1 className="text-xl font-bold">HAGA Companion</h1>
      <p className="mt-1 text-sm text-slate-400">{t.about.version}</p>
      <p className="mt-4 text-sm">{t.about.developedBy}</p>
      <button type="button" className="btn-primary mt-6" onClick={() => window.haga.closeWindow()}>
        {t.common.ok}
      </button>
    </div>
  )
}
