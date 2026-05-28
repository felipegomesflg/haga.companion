import fs from 'node:fs'

const p = 'electron/services/buildService.ts'
let s = fs.readFileSync(p, 'utf8')

if (!s.includes('function refTables()')) {
  s = s.replace(
    "import { importCompletedObjectiveIds } from './objectiveService'\n",
    "import { importCompletedObjectiveIds } from './objectiveService'\nimport { getReferenceTableNames } from '../lib/refTables'\nimport { getAppLocale } from './localeService'\n\nfunction refTables() {\n  return getReferenceTableNames(getAppLocale())\n}\n",
  )
}

const tableByFragment = [
  ['icon_dds_file as iconDdsFile FROM', 'uniqueItems'],
  ['item_class, tags FROM', 'baseItems'],
  ['item_class FROM', 'uniqueItems'],
  ['display_label FROM', 'gemTags'],
  ['recommended_supports FROM', 'gems'],
  ['gem_type, color, crafting_level FROM', 'gems'],
  ['gem_type, color FROM', 'gems'],
  ['gem_type FROM', 'gems'],
  ['tags FROM', 'baseItems'],
  ['text FROM', 'mods'],
  ['item_class as itemClass, icon_dds_file as iconDdsFile FROM', 'uniqueItems'],
  ['item_class as itemClass, icon_dds_file as iconDdsFile FROM', 'baseItems'],
  ['generation_type = ? AND text LIKE', 'mods'],
]

for (const [fragment, tableKey] of tableByFragment) {
  const re = new RegExp(`(${fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\s+WHERE`, 'g')
  s = s.replace(re, `$1 \${refTables().${tableKey}} WHERE`)
}

s = s.replace(/FROM\s+\$\{refTables\(\)\.(\w+)\}\s+WHERE/g, 'FROM ${refTables().$1} WHERE')

// Fix any remaining empty FROM
s = s.replace(/FROM\s+WHERE/g, 'FROM ${refTables().gems} WHERE')

// Use template literals for prepare calls that contain ${refTables
s = s.replace(/\.prepare\('([^']*\$\{refTables\(\)[^']*)'\)/g, '.prepare(`$1`)')
s = s.replace(/\.prepare\(`([^`]*)\$\{refTables\(\)\.(\w+)\}([^`]*)`\)/g, '.prepare(`$1${refTables().$2}$3`)')

fs.writeFileSync(p, s)
const broken = (s.match(/FROM\s+WHERE/g) ?? []).length
console.log('remaining broken FROM clauses:', broken)
