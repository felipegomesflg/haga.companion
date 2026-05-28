import { useCallback, useEffect, useState } from 'react'
import type { AppLocale } from '../types/locale'
import { DEFAULT_LOCALE } from '../types/locale'
import { formatMessage, getDictionary, type TranslationDict } from '../i18n'

export function useI18n() {
  const [locale, setLocale] = useState<AppLocale>(DEFAULT_LOCALE)
  const [dict, setDict] = useState<TranslationDict>(() => getDictionary(DEFAULT_LOCALE))

  const refresh = useCallback(async () => {
    const settings = await window.haga.getSettings()
    const next = settings.locale ?? DEFAULT_LOCALE
    setLocale(next)
    setDict(getDictionary(next))
  }, [])

  useEffect(() => {
    void refresh()
    const onLocale = () => void refresh()
    window.addEventListener('haga:localeChanged', onLocale)
    return () => window.removeEventListener('haga:localeChanged', onLocale)
  }, [refresh])

  const t = dict
  const fmt = formatMessage

  return { locale, t, fmt }
}
