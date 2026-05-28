import { useEffect, useState } from 'react'
import type { AppSettings, BuildProfile } from '../types/build'
import type { AppLocale } from '../types/locale'
import { LOCALE_OPTIONS } from '../types/locale'
import { useI18n } from '../hooks/useI18n'

export function SettingsWindow() {
  const { t, fmt } = useI18n()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [builds, setBuilds] = useState<BuildProfile[]>([])
  const [activeBuildId, setActiveBuildId] = useState('')
  const [importCode, setImportCode] = useState('')
  const [exportCode, setExportCode] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    Promise.all([window.haga.getSettings(), window.haga.getBuildProfiles(), window.haga.getActiveBuild()]).then(
      ([s, b, active]) => {
        setSettings(s)
        setBuilds(b)
        setActiveBuildId(active?.id ?? '')
      },
    )
  }, [])

  if (!settings) return <div className="p-6 text-slate-300">{t.common.loading}</div>

  const save = async (partial: Partial<AppSettings>) => {
    const next = await window.haga.saveSettings(partial)
    setSettings(next)
    setMessage(t.settings.savedRestartHotkeys)
  }

  const doExport = async () => {
    if (!activeBuildId) return
    const code = await window.haga.exportShareCode(activeBuildId)
    setExportCode(code)
    await navigator.clipboard.writeText(code)
    setMessage(t.settings.shareCodeCopied)
  }

  const doImport = async () => {
    try {
      const profile = await window.haga.importShareCode(importCode)
      setMessage(fmt(t.settings.importedBuild, { name: profile.name }))
      const list = await window.haga.getBuildProfiles()
      setBuilds(list)
      setActiveBuildId(profile.id)
    } catch {
      setMessage(t.settings.invalidShareCode)
    }
  }

  const shortcutFields = [
    ['hotkeyToggleBuildPanel', t.settings.toggleBuildPanel],
    ['hotkeyToggleCampaignPanel', t.settings.toggleCampaignPanel],
    ['hotkeyToggleHud', t.settings.toggleHud],
    ['hotkeyToggleClickThrough', t.settings.toggleClickThrough],
    ['hotkeyOpenSettings', t.settings.openSettings],
  ] as const

  return (
    <div className="h-full overflow-y-auto bg-slate-950 p-6 text-slate-100">
      <h1 className="mb-4 text-xl font-bold">{t.settings.title}</h1>

      <section className="mb-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase text-amber-400">{t.settings.language}</h2>
        <label className="block text-sm">
          {t.settings.language}
          <select
            className="mt-1 w-full"
            value={settings.locale}
            onChange={(e) => save({ locale: e.target.value as AppLocale })}
          >
            {LOCALE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-slate-400">{t.settings.languageHint}</p>
        <p className="rounded-md border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs leading-relaxed text-amber-200/90">
          {t.settings.languageGameMatchHint}
        </p>
      </section>

      <section className="mb-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase text-amber-400">{t.settings.shortcuts}</h2>
        {shortcutFields.map(([key, label]) => (
          <label key={key} className="block text-sm">
            {label}
            <input
              className="mt-1 w-full"
              value={settings[key]}
              onChange={(e) => save({ [key]: e.target.value })}
            />
          </label>
        ))}
      </section>

      <section className="mb-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase text-amber-400">{t.settings.campaignDetection}</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.campaignAutoDetectAct}
            onChange={(e) => save({ campaignAutoDetectAct: e.target.checked })}
          />
          {t.settings.autoDetectAct}
        </label>
        <label className="block text-sm">
          {t.settings.clientLogPath}
          <input
            className="mt-1 w-full"
            placeholder={t.settings.clientLogPlaceholder}
            value={settings.clientLogPath}
            onChange={(e) => save({ clientLogPath: e.target.value })}
          />
        </label>
        <p className="text-xs text-slate-400">{t.settings.clientLogHint}</p>
      </section>

      <section className="mb-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase text-amber-400">{t.settings.build}</h2>
        <label className="block text-sm">
          {t.settings.activeBuild}
          <select
            className="mt-1 w-full"
            value={activeBuildId}
            onChange={async (e) => {
              await window.haga.setActiveBuild(e.target.value)
              setActiveBuildId(e.target.value)
            }}
          >
            {builds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-primary" onClick={doExport}>
          {t.settings.exportShareCode}
        </button>
        {exportCode && <textarea className="w-full text-xs" rows={3} readOnly value={exportCode} />}
        <textarea
          className="w-full"
          rows={3}
          placeholder={t.settings.shareCodePlaceholder}
          value={importCode}
          onChange={(e) => setImportCode(e.target.value)}
        />
        <button type="button" className="btn-ghost" onClick={doImport}>
          {t.settings.importShareCode}
        </button>
      </section>

      {message && <p className="text-sm text-amber-300">{message}</p>}
    </div>
  )
}
