import { useEffect, useState } from 'react'
import type { AppSettings } from '../types/build'
import { formatHotkey } from '../lib/formatHotkey'

const SHORTCUT_ROWS: Array<{
  key:
    | 'hotkeyToggleBuildPanel'
    | 'hotkeyToggleCampaignPanel'
    | 'hotkeyToggleHud'
    | 'hotkeyToggleClickThrough'
    | 'hotkeyOpenSettings'
  label: string
}> = [
  { key: 'hotkeyToggleBuildPanel', label: 'Build panel' },
  { key: 'hotkeyToggleCampaignPanel', label: 'Campaign panel' },
  { key: 'hotkeyToggleHud', label: 'HUD' },
  { key: 'hotkeyToggleClickThrough', label: 'Click-through' },
  { key: 'hotkeyOpenSettings', label: 'Settings' },
]

export function SplashWindow() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [logoFailed, setLogoFailed] = useState(false)

  useEffect(() => {
    window.haga.getSettings().then(setSettings)
  }, [])

  return (
    <div className="splash-screen">
      <div className="splash-screen__card">
        {!logoFailed ? (
          <img
            src="/logo.png"
            alt="HAGA"
            className="splash-screen__logo"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <div className="splash-screen__logo-fallback" aria-hidden>
            HAGA
          </div>
        )}

        <h1 className="splash-screen__title">HAGA Companion</h1>
        <p className="splash-screen__subtitle">Path of Exile 2 companion</p>

        <section className="splash-screen__shortcuts">
          <h2 className="splash-screen__shortcuts-title">Shortcuts</h2>
          <ul className="splash-screen__shortcuts-list">
            {SHORTCUT_ROWS.map(({ key, label }) => (
              <li key={key} className="splash-screen__shortcut-row">
                <span>{label}</span>
                <kbd>{settings ? formatHotkey(settings[key]) : '…'}</kbd>
              </li>
            ))}
          </ul>
        </section>

        <p className="splash-screen__hint">Starting…</p>
      </div>
    </div>
  )
}
