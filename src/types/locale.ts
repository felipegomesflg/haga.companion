export type AppLocale = 'en' | 'pt-BR'

export const DEFAULT_LOCALE: AppLocale = 'en'

export const LOCALE_OPTIONS: Array<{ value: AppLocale; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
]

export function normalizeLocale(value: string | null | undefined): AppLocale {
  return value === 'pt-BR' ? 'pt-BR' : 'en'
}
