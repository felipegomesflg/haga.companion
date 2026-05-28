import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const OUT = path.join(ROOT, 'data', 'runtime', 'campaign_objectives.json')

const ARCS = [
  {
    id: 'act1',
    actNumber: 1,
    name: 'Act 1',
    prelude: null,
    pagePath: '/act1',
    assetUrl: 'https://www.poe2-leveling.com/assets/act1-BYXzTRfi.js',
    actIndex: 0,
  },
  {
    id: 'act2',
    actNumber: 2,
    name: 'Act 2',
    prelude: null,
    pagePath: '/act2',
    assetUrl: 'https://www.poe2-leveling.com/assets/act2-zCMfTgdF.js',
    actIndex: 1,
  },
  {
    id: 'act3',
    actNumber: 3,
    name: 'Act 3',
    prelude: null,
    pagePath: '/act3',
    assetUrl: 'https://www.poe2-leveling.com/assets/act3-C6EsRKWq.js',
    actIndex: 2,
  },
  {
    id: 'act4',
    actNumber: 4,
    name: 'Act 4',
    prelude: null,
    pagePath: '/act4',
    assetUrl: 'https://www.poe2-leveling.com/assets/act4-xRXgjZh5.js',
    actIndex: 3,
  },
  {
    id: 'act5-1',
    actNumber: 5,
    name: 'Act 5.1 - Ogham',
    prelude: 'Ogham',
    pagePath: '/act5-1',
    assetUrl: 'https://www.poe2-leveling.com/assets/act5-1-xj7_djVK.js',
    actIndex: 4,
  },
  {
    id: 'act5-2',
    actNumber: 5,
    name: 'Act 5.2 - Khari Bazaar',
    prelude: 'Khari Bazaar',
    pagePath: '/act5-2',
    assetUrl: 'https://www.poe2-leveling.com/assets/act5-2-Tf7L9kMB.js',
    actIndex: 5,
  },
  {
    id: 'act5-3',
    actNumber: 5,
    name: 'Act 5.3 - Mount Kriar',
    prelude: 'Mount Kriar',
    pagePath: '/act5-3',
    assetUrl: 'https://www.poe2-leveling.com/assets/act5-3-BNP2i-gV.js',
    actIndex: 6,
  },
]

const IMAGE_PATHS = {
  'Act 1': [
    '/poe2-act1-route.webp',
    '/poe2-unas-home-act1.webp',
    '/poe2-psalm-of-madness-act1.webp',
  ],
  'Act 2': [
    '/poe2-act2-route.webp',
    '/poe2-act2-route-garukhan.webp',
    '/poe2-act2-route-kabalas-clan.webp',
  ],
  'Act 3': [
    '/poe2-act3-route.webp',
    '/poe2-act3-route-basket.webp',
    '/poe2-act3-route-venom.webp',
  ],
}

const BASE = 'https://www.poe2-leveling.com'

function actImageKey(title) {
  if (title.includes('Act 1') || title === '第一章') return 'Act 1'
  if (title.includes('Act 2') || title === '第二章') return 'Act 2'
  if (title.includes('Act 3') || title === '第三章') return 'Act 3'
  return null
}

function parseStep(stepText, index) {
  const dash = stepText.indexOf(' - ')
  const location = dash >= 0 ? stepText.slice(0, dash).trim() : null
  const body = dash >= 0 ? stepText.slice(dash + 3).trim() : stepText.trim()
  return {
    stepNumber: index + 1,
    location,
    text: stepText.trim(),
    objective: body,
  }
}

function extractMetaFromRouteJs(js) {
  const meta = {}
  const re =
    /\{name:"([^"]+)",content:"((?:\\.|[^"\\])*)"\}/g
  let m
  while ((m = re.exec(js)) !== null) {
    meta[m[1]] = m[2].replace(/\\"/g, '"')
  }
  const ogRe =
    /\{property:"([^"]+)",content:"((?:\\.|[^"\\])*)"\}/g
  while ((m = ogRe.exec(js)) !== null) {
    meta[m[1]] = m[2].replace(/\\"/g, '"')
  }
  return meta
}

async function loadTranslations() {
  const sharedUrl = 'https://www.poe2-leveling.com/assets/shared-BMKsFsAw.js'
  const res = await fetch(sharedUrl)
  if (!res.ok) throw new Error(`Failed to fetch shared: ${res.status}`)
  const code = await res.text()
  const marker = 'const b='
  const exportMarker = ',g={"Act 1"'
  const start = code.indexOf(marker)
  const end = code.indexOf(exportMarker)
  if (start < 0 || end < 0) throw new Error('Could not locate translations object in shared.js')
  const objCode = code.slice(start + 'const b='.length, end)
  // eslint-disable-next-line no-eval
  const translations = eval(`(${objCode})`)
  return { translations, sharedUrl }
}

async function main() {
  const { translations, sharedUrl } = await loadTranslations()
  const languages = Object.keys(translations)
  const arcs = []

  for (const arc of ARCS) {
    const routeRes = await fetch(arc.assetUrl)
    if (!routeRes.ok) throw new Error(`Failed ${arc.assetUrl}: ${routeRes.status}`)
    const routeJs = await routeRes.text()

    const localized = {}
    for (const lang of languages) {
      const act = translations[lang].acts[arc.actIndex]
      const imageKey = actImageKey(act.title)
      const captions = imageKey ? translations[lang].imageCaptions?.[imageKey] : null
      const paths = imageKey ? IMAGE_PATHS[imageKey] : null
      const images =
        paths && captions
          ? paths.map((src, i) => ({
              src,
              url: `${BASE}${src}`,
              caption: captions[i] ?? '',
            }))
          : []

      localized[lang] = {
        title: act.title,
        description: act.description,
        steps: act.steps.map((s, i) => parseStep(s, i)),
        images,
      }
    }

    const en = localized.en
    arcs.push({
      ...arc,
      pageUrl: `${BASE}${arc.pagePath}`,
      sharedModuleUrl: sharedUrl,
      routeMeta: extractMetaFromRouteJs(routeJs),
      title: en.title,
      description: en.description,
      steps: en.steps,
      images: en.images,
      translations: localized,
    })
  }

  const payload = {
    source: 'poe2-leveling.com',
    fetchedAt: new Date().toISOString(),
    sharedModuleUrl: sharedUrl,
    languages,
    arcs,
    acts: arcs.map((a) => ({
      actNumber: a.actNumber,
      name: a.name,
      isAvailable: true,
    })),
    objectives: arcs.flatMap((arc) =>
      arc.steps.map((step, i) => ({
        id: `${arc.id}-step-${step.stepNumber}`,
        actNumber: arc.actNumber,
        arcId: arc.id,
        sortOrder: (step.stepNumber - 1) * 10 + 10,
        title: step.location
          ? `${step.location} — ${step.objective.slice(0, 120)}${step.objective.length > 120 ? '…' : ''}`
          : step.objective.slice(0, 160),
        description: step.text,
        isOptional: false,
      })),
    ),
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf-8')
  console.log(`Wrote ${OUT} (${arcs.length} arcs, ${payload.objectives.length} objectives)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
