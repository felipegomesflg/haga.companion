import { useEffect, useState } from 'react'
import type { GemUnlockAlert } from '../types/build'
import { GemName } from '../components/GemName'
import { useI18n } from '../hooks/useI18n'

export function GemUnlockToastWindow() {
  const { t, fmt } = useI18n()
  const [alert, setAlert] = useState<GemUnlockAlert | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onAlert = (event: Event) => {
      const detail = (event as CustomEvent<GemUnlockAlert>).detail
      if (!detail) return
      setAlert(detail)
      setVisible(false)
      requestAnimationFrame(() => setVisible(true))
    }

    window.addEventListener('haga:gemUnlockAlert', onAlert as EventListener)
    return () => window.removeEventListener('haga:gemUnlockAlert', onAlert as EventListener)
  }, [])

  if (!alert) return null

  return (
    <div className="gem-unlock-toast-root">
      <div className={`gem-unlock-toast ${visible ? 'gem-unlock-toast--visible' : ''}`}>
        <div className="gem-unlock-toast__eyebrow">{t.toast.gemUnlocked}</div>
        <div className="gem-unlock-toast__title">
          {t.toast.canNowUse}{' '}
          <GemName name={alert.gemName} color={alert.color} variant="text" className="gem-unlock-toast__gem" />
        </div>
        <div className="gem-unlock-toast__meta">
          {fmt(t.toast.levelMeta, { level: alert.requiredLevel, type: alert.gemType })}
        </div>
      </div>
    </div>
  )
}
