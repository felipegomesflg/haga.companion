import { getReferenceDb } from '../db/referenceDb'
import { getUserDb } from '../db/userDb'
import { resolveExpectedZoneForObjective } from '../lib/objectiveZone'
import { getAppLocale } from './localeService'
import type { CampaignArc, CampaignObjective, HudState } from '../../src/types/build'

function getProgressMap(): Map<string, boolean> {
  const rows = getUserDb()
    .prepare('SELECT objective_id, is_completed FROM campaign_objective_progress')
    .all() as Array<{ objective_id: string; is_completed: number }>

  return new Map(rows.map((r) => [r.objective_id, r.is_completed === 1]))
}

type ObjectiveRow = {
  id: string
  arc_id: string
  act_number: number
  sort_order: number
  title: string
  description: string | null
  is_optional: number
  objective_type: string | null
  reward_tags: string | null
  expected_zone_name: string | null
}

function mapObjectiveRow(row: ObjectiveRow, progress: Map<string, boolean>): CampaignObjective {
  let rewardTags: string[] | null = null
  if (row.reward_tags) {
    try {
      rewardTags = JSON.parse(row.reward_tags) as string[]
    } catch {
      rewardTags = null
    }
  }

  return {
    id: row.id,
    arcId: row.arc_id,
    actNumber: row.act_number,
    sortOrder: row.sort_order,
    title: row.title,
    description: row.description,
    isOptional: row.is_optional === 1,
    objectiveType: row.objective_type,
    rewardTags,
    expectedZoneName: row.expected_zone_name,
    isCompleted: progress.get(row.id) ?? false,
  }
}

function loadObjectives(arcId?: string): CampaignObjective[] {
  const ref = getReferenceDb()
  const progress = getProgressMap()
  const locale = getAppLocale()
  const usePt = locale === 'pt-BR'

  const titleCol = usePt ? 'COALESCE(pt.title, o.title)' : 'o.title'
  const descCol = usePt ? 'COALESCE(pt.description, o.description)' : 'o.description'

  const sql =
    arcId !== undefined
      ? `
    SELECT o.id, o.arc_id, o.act_number, o.sort_order,
           ${titleCol} AS title, ${descCol} AS description,
           o.is_optional, o.objective_type, o.reward_tags, o.expected_zone_name
    FROM campaign_objectives o
    JOIN campaign_arcs a ON a.id = o.arc_id
    ${usePt ? 'LEFT JOIN campaign_objectives_pt pt ON pt.id = o.id' : ''}
    WHERE a.is_available = 1 AND o.arc_id = ?
    ORDER BY o.sort_order ASC
  `
      : `
    SELECT o.id, o.arc_id, o.act_number, o.sort_order,
           ${titleCol} AS title, ${descCol} AS description,
           o.is_optional, o.objective_type, o.reward_tags, o.expected_zone_name
    FROM campaign_objectives o
    JOIN campaign_arcs a ON a.id = o.arc_id
    ${usePt ? 'LEFT JOIN campaign_objectives_pt pt ON pt.id = o.id' : ''}
    WHERE a.is_available = 1
    ORDER BY a.sort_order ASC, o.sort_order ASC
  `

  const rows = (
    arcId !== undefined ? ref.prepare(sql).all(arcId) : ref.prepare(sql).all()
  ) as ObjectiveRow[]

  return rows.map((row) => mapObjectiveRow(row, progress))
}

export function getNextObjective(): CampaignObjective | null {
  const objectives = loadObjectives()
  return objectives.find((o) => !o.isCompleted) ?? null
}

export function getHudState(): HudState {
  const objective = getNextObjective()
  return {
    objective,
    expectedZoneName: objective ? resolveExpectedZoneForObjective(objective) : null,
  }
}

export function toggleObjective(objectiveId: string, completed: boolean): HudState {
  const user = getUserDb()
  const now = completed ? new Date().toISOString() : null

  user
    .prepare(
      `
    INSERT INTO campaign_objective_progress (objective_id, is_completed, completed_at)
    VALUES (?, ?, ?)
    ON CONFLICT(objective_id) DO UPDATE SET
      is_completed = excluded.is_completed,
      completed_at = excluded.completed_at
  `,
    )
    .run(objectiveId, completed ? 1 : 0, now)

  return getHudState()
}

export function getCampaignArcs(): CampaignArc[] {
  const locale = getAppLocale()
  const usePt = locale === 'pt-BR'
  const nameCol = usePt ? 'COALESCE(pt.name, a.name)' : 'a.name'
  const tabCol = usePt ? 'COALESCE(pt.tab_label, a.tab_label, a.name)' : 'COALESCE(a.tab_label, a.name)'
  const descCol = usePt ? 'COALESCE(pt.description, a.description)' : 'a.description'

  const rows = getReferenceDb()
    .prepare(
      `SELECT a.id, a.act_number, ${nameCol} AS name, ${tabCol} AS tab_label,
              ${descCol} AS description, a.sort_order, a.is_available
       FROM campaign_arcs a
       ${usePt ? 'LEFT JOIN campaign_arcs_pt pt ON pt.id = a.id' : ''}
       ORDER BY a.sort_order ASC`,
    )
    .all() as Array<{
    id: string
    act_number: number
    name: string
    tab_label: string | null
    description: string | null
    sort_order: number
    is_available: number
  }>

  return rows.map((r) => ({
    id: r.id,
    actNumber: r.act_number,
    name: r.name,
    tabLabel: r.tab_label ?? r.name,
    description: r.description,
    sortOrder: r.sort_order,
    isAvailable: r.is_available === 1,
  }))
}

/** @deprecated Use getCampaignArcs — kept for older IPC callers */
export function getCampaignActs(): CampaignArc[] {
  return getCampaignArcs()
}

export function getCampaignObjectives(arcId: string): CampaignObjective[] {
  return loadObjectives(arcId)
}

export function getFirstIncompleteArcId(): string {
  const next = getNextObjective()
  if (next?.arcId) return next.arcId
  const arcs = getCampaignArcs().filter((a) => a.isAvailable)
  return arcs[0]?.id ?? 'act1'
}

/** @deprecated Use getFirstIncompleteArcId */
export function getFirstIncompleteAct(): number {
  const next = getNextObjective()
  return next?.actNumber ?? 1
}

export function getCompletedObjectiveIds(): string[] {
  return [...getProgressMap().entries()].filter(([, completed]) => completed).map(([id]) => id)
}

export function importCompletedObjectiveIds(objectiveIds: string[]): void {
  const db = getUserDb()
  const now = new Date().toISOString()
  const stmt = db.prepare(`
    INSERT INTO campaign_objective_progress (objective_id, is_completed, completed_at)
    VALUES (?, 1, ?)
    ON CONFLICT(objective_id) DO UPDATE SET
      is_completed = 1,
      completed_at = excluded.completed_at
  `)

  for (const objectiveId of objectiveIds) {
    if (!objectiveId) continue
    stmt.run(objectiveId, now)
  }
}
