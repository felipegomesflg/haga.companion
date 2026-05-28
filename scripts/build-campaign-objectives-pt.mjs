import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CAMPAIGN_ARCS } from './campaign-objectives-data.mjs'
import { OBJECTIVE_EXPECTED_ZONES } from './objective-expected-zones.mjs'
import { applyPoe2PtGlossary } from './lib/applyPoe2PtGlossary.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TRANSLATIONS = path.join(__dirname, 'campaign-pt-i18n.json')
const USER_PT_OVERRIDE = path.join(__dirname, '..', 'data', 'runtime', 'pt', 'campaign_objectives.json')
const OUT = path.join(__dirname, '..', 'data', 'runtime', 'campaign_objectives_pt.json')

if (fs.existsSync(USER_PT_OVERRIDE)) {
  const override = JSON.parse(fs.readFileSync(USER_PT_OVERRIDE, 'utf8'))
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(override, null, 2), 'utf-8')
  console.log(`Wrote ${OUT} from user override ${USER_PT_OVERRIDE}`)
  process.exit(0)
}

const i18n = JSON.parse(fs.readFileSync(TRANSLATIONS, 'utf8'))

function translateArc(arc) {
  const pt = i18n.arcs?.[arc.id]
  return {
    ...arc,
    name: applyPoe2PtGlossary(pt?.name ?? arc.name),
    tabLabel: applyPoe2PtGlossary(pt?.tabLabel ?? arc.tabLabel),
    description: applyPoe2PtGlossary(pt?.description ?? arc.description),
    objectives: arc.objectives.map((obj) => {
      const ptObj = i18n.objectives?.[obj.id]
      return {
        ...obj,
        title: applyPoe2PtGlossary(ptObj?.title ?? obj.title),
        description: applyPoe2PtGlossary(ptObj?.description ?? obj.description),
      }
    }),
  }
}

const CAMPAIGN_ARCS_PT = CAMPAIGN_ARCS.map(translateArc)

function buildPayload() {
  const arcs = CAMPAIGN_ARCS_PT.map((arc) => ({
    id: arc.id,
    actNumber: arc.actNumber,
    name: arc.name,
    tabLabel: arc.tabLabel,
    description: arc.description,
    sortOrder: arc.sortOrder,
    isAvailable: arc.isAvailable !== false,
    objectiveCount: arc.objectives.length,
  }))

  const objectives = CAMPAIGN_ARCS_PT.flatMap((arc) =>
    arc.objectives.map((obj, index) => ({
      id: obj.id,
      arcId: arc.id,
      actNumber: arc.actNumber,
      sortOrder: (index + 1) * 10,
      title: obj.title,
      description: obj.description,
      isOptional: obj.isOptional ?? false,
      objectiveType: obj.objectiveType ?? 'campaign',
      rewardTags: obj.rewardTags ?? [],
      expectedZoneName: OBJECTIVE_EXPECTED_ZONES[obj.id] ?? null,
    })),
  )

  return {
    source: 'haga-overlay-enriched-pt-BR',
    locale: 'pt-BR',
    fetchedAt: new Date().toISOString(),
    version: 2,
    arcs,
    objectives,
  }
}

const payload = buildPayload()
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf-8')

const missing = CAMPAIGN_ARCS.flatMap((arc) => arc.objectives.map((o) => o.id)).filter((id) => !i18n.objectives?.[id])
if (missing.length) {
  console.warn(`[campaign-pt] Missing ${missing.length} objective translations (using EN fallback)`)
}

console.log(`Wrote ${OUT} — ${payload.arcs.length} arcs, ${payload.objectives.length} objectives`)
