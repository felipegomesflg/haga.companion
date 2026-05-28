import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ARC_TRANSLATIONS, TITLE_TRANSLATIONS } from './campaign-pt-translations-data.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const I18N = path.join(__dirname, 'campaign-pt-i18n.json')
const DESCRIPTIONS = path.join(__dirname, 'campaign-pt-descriptions-generated.json')

const data = JSON.parse(fs.readFileSync(I18N, 'utf8'))
const DESCRIPTION_TRANSLATIONS = JSON.parse(fs.readFileSync(DESCRIPTIONS, 'utf8'))

for (const [id, pt] of Object.entries(ARC_TRANSLATIONS)) {
  if (!data.arcs[id]) continue
  data.arcs[id] = { ...data.arcs[id], ...pt }
}

for (const [id, title] of Object.entries(TITLE_TRANSLATIONS)) {
  if (!data.objectives[id]) continue
  data.objectives[id].title = title
}

for (const [id, description] of Object.entries(DESCRIPTION_TRANSLATIONS)) {
  if (!data.objectives[id]) continue
  data.objectives[id].description = description
}

fs.writeFileSync(I18N, JSON.stringify(data, null, 2), 'utf-8')

const total = Object.keys(data.objectives).length
const translated = Object.keys(DESCRIPTION_TRANSLATIONS).length
console.log(`Applied PT translations: ${translated}/${total} descriptions, ${Object.keys(ARC_TRANSLATIONS).length} arcs`)
