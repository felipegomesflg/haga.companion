import type { AppLocale } from '../types/locale'
import { en, type TranslationDict } from './en'
import { ptBR } from './pt-BR'

const dictionaries: Record<AppLocale, TranslationDict> = {
  en,
  'pt-BR': ptBR,
}

export function getDictionary(locale: AppLocale): TranslationDict {
  return dictionaries[locale] ?? en
}

export function formatMessage(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`))
}

export type { TranslationDict }
