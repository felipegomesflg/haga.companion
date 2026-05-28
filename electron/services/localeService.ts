import { getSetting, getUserDb } from '../db/userDb'
import type { AppLocale } from '../../src/types/locale'
import { DEFAULT_LOCALE, normalizeLocale } from '../../src/types/locale'

export function getAppLocale(): AppLocale {
  return normalizeLocale(getSetting(getUserDb(), 'locale') || DEFAULT_LOCALE)
}

export function isPtLocale(locale: AppLocale = getAppLocale()): boolean {
  return locale === 'pt-BR'
}
