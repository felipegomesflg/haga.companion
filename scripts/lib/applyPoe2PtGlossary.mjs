import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const GLOSSARY_PATH = path.join(__dirname, '..', 'poe2-pt-glossary.json')

let cachedTerms = null

function loadTerms() {
  if (cachedTerms) return cachedTerms
  const raw = JSON.parse(fs.readFileSync(GLOSSARY_PATH, 'utf8'))
  cachedTerms = Object.entries(raw.terms ?? raw)
    .map(([en, pt]) => [en, pt])
    .sort((a, b) => b[0].length - a[0].length)
  return cachedTerms
}

const PHRASE_FIXES = [
  [/\bLevel (\d+)\b/g, 'Nível $1'],
  [/\(L(\d+)\)/g, '(Nv. $1)'],
  [/\btrial\b/gi, (m) => (m[0] === 'T' ? 'Provação' : 'provação')],
  [/\bSkill L(\d+)\b/g, 'Gema Nv. $1'],
  [/\bFlask\b/g, 'Frasco'],
  [/\bskill de espírito\b/gi, 'habilidade de espírito'],
]

/** Short EN words must not match inside PT words (e.g. charm → charme). */
const WORD_BOUNDARY_TERMS = new Set([
  'charm',
  'flask',
  'flasks',
  'skill',
  'trial',
  'build',
  'loot',
  'farm',
  'gear',
  'craft',
])

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function applyTerm(out, en, pt) {
  if (WORD_BOUNDARY_TERMS.has(en.toLowerCase())) {
    return out.replace(new RegExp(`\\b${escapeRegex(en)}\\b`, 'gi'), pt)
  }
  return out.split(en).join(pt)
}

/** Replace EN proper nouns with official PT-BR client names (PoE2DB). */
export function applyPoe2PtGlossary(text) {
  if (!text || typeof text !== 'string') return text
  let out = text
  for (const [en, pt] of loadTerms()) {
    if (!en || en === pt) continue
    out = applyTerm(out, en, pt)
  }
  for (const fix of PHRASE_FIXES) {
    out = out.replace(fix[0], fix[1])
  }
  return out
}
