import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ObjectiveCheckbox } from '../components/ObjectiveCheckbox'
import { OverlayCloseButton } from '../components/OverlayCloseButton'
import { useI18n } from '../hooks/useI18n'
import type { CampaignArc, CampaignObjective, GameLocationState } from '../types/build'

function groupObjectives(objectives: CampaignObjective[]) {
  const campaign = objectives.filter((o) => !o.isOptional)
  const optional = objectives.filter((o) => o.isOptional)
  return { campaign, optional }
}

export function CampaignPanelWindow() {
  const { t, fmt } = useI18n()
  const [arcs, setArcs] = useState<CampaignArc[]>([])
  const [activeArcId, setActiveArcId] = useState('act1')
  const [objectives, setObjectives] = useState<CampaignObjective[]>([])
  const [gameLocation, setGameLocation] = useState<GameLocationState | null>(null)
  const manualArcRef = useRef(false)

  const typeLabels = t.hud.objectiveTypes
  const objectiveTypeLabel = (type: string | null): string => {
    if (!type) return typeLabels.default
    return typeLabels[type as keyof typeof typeLabels] ?? type
  }

  const loadArc = useCallback(async (arcId: string) => {
    const objs = await window.haga.getCampaignObjectives(arcId)
    setObjectives(objs)
  }, [])

  const reloadArcs = useCallback(async () => {
    const arcList = await window.haga.getCampaignArcs()
    setArcs(arcList)
  }, [])

  const refreshGameLocation = useCallback(async () => {
    const location = await window.haga.getGameLocation()
    setGameLocation(location)

    if (location.arcId && !manualArcRef.current) {
      setActiveArcId(location.arcId)
      await loadArc(location.arcId)
    }
  }, [loadArc])

  useEffect(() => {
    const init = async () => {
      const [arcList, firstArcId, location] = await Promise.all([
        window.haga.getCampaignArcs(),
        window.haga.getFirstIncompleteArcId(),
        window.haga.getGameLocation(),
      ])
      setArcs(arcList)
      setGameLocation(location)

      const initialArcId = location.arcId ?? firstArcId
      setActiveArcId(initialArcId)
      await loadArc(initialArcId)
    }
    void init()
  }, [loadArc])

  useEffect(() => {
    const onProgressUpdated = () => {
      void loadArc(activeArcId)
    }
    const onGameLocationUpdated = () => {
      manualArcRef.current = false
      void refreshGameLocation()
    }
    const onLocaleChanged = () => {
      void reloadArcs()
      void loadArc(activeArcId)
    }

    window.addEventListener('haga:hudUpdated', onProgressUpdated)
    window.addEventListener('haga:gameLocationUpdated', onGameLocationUpdated)
    window.addEventListener('haga:localeChanged', onLocaleChanged)
    return () => {
      window.removeEventListener('haga:hudUpdated', onProgressUpdated)
      window.removeEventListener('haga:gameLocationUpdated', onGameLocationUpdated)
      window.removeEventListener('haga:localeChanged', onLocaleChanged)
    }
  }, [activeArcId, loadArc, refreshGameLocation, reloadArcs])

  const onArcChange = async (arcId: string) => {
    manualArcRef.current = true
    setActiveArcId(arcId)
    await loadArc(arcId)
  }

  const toggle = async (objective: CampaignObjective, completed: boolean) => {
    await window.haga.toggleObjective(objective.id, completed)
    await loadArc(activeArcId)
  }

  const currentArc = arcs.find((a) => a.id === activeArcId)
  const detectedArcId = gameLocation?.arcId ?? null
  const { campaign, optional } = useMemo(() => groupObjectives(objectives), [objectives])

  const completedCount = objectives.filter((o) => o.isCompleted).length
  const suggestedObjectiveId = useMemo(() => {
    if (!detectedArcId || activeArcId !== detectedArcId) return null
    return objectives.find((obj) => !obj.isCompleted)?.id ?? null
  }, [activeArcId, detectedArcId, objectives])

  const locationBanner = useMemo(() => {
    if (!gameLocation || gameLocation.status === 'idle') return null
    if (gameLocation.status === 'missing_log') return t.campaign.missingLog
    if (!gameLocation.areaName) {
      return fmt(t.campaign.logOk, { path: gameLocation.logPath ?? 'unknown' })
    }
    if (gameLocation.arcId && gameLocation.arcTabLabel) {
      return fmt(t.campaign.inGameMapped, {
        area: gameLocation.areaName,
        arc: gameLocation.arcTabLabel,
        match: gameLocation.matchType ?? 'mapped',
      })
    }
    return fmt(t.campaign.inGameUnmapped, { area: gameLocation.areaName })
  }, [gameLocation, t, fmt])

  const renderObjective = (obj: CampaignObjective) => {
    const isSuggested = obj.id === suggestedObjectiveId

    return (
      <li
        key={obj.id}
        className={`rounded-md border px-3 py-3 ${
          obj.isCompleted
            ? 'border-slate-800 bg-slate-900/40 opacity-70'
            : isSuggested
              ? 'campaign-objective--detected border-amber-500/70 bg-amber-950/20 ring-1 ring-amber-500/40'
              : obj.isOptional
                ? 'border-dashed border-slate-600 bg-slate-900/20'
                : 'border-amber-900/40 bg-slate-900/30'
        }`}
      >
        <div className="flex items-start gap-3">
          <ObjectiveCheckbox
            checked={obj.isCompleted}
            className="mt-1 h-4 w-4 shrink-0 accent-amber-500"
            onToggle={(completed) => void toggle(obj, completed)}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium leading-snug">{obj.title}</span>
              {isSuggested && (
                <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                  {t.campaign.inThisZone}
                </span>
              )}
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                  obj.isOptional ? 'bg-slate-700 text-slate-300' : 'bg-amber-900/60 text-amber-200'
                }`}
              >
                {obj.isOptional ? t.common.optional : t.common.required}
              </span>
              {obj.objectiveType && (
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                  {objectiveTypeLabel(obj.objectiveType)}
                </span>
              )}
            </div>
            {obj.description && (
              <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-400">{obj.description}</p>
            )}
            {obj.rewardTags && obj.rewardTags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {obj.rewardTags.map((tag) => (
                  <span key={tag} className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-500">
                    {tag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </li>
    )
  }

  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <div className="overlay-panel flex h-full w-full max-w-3xl flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <div>
            <span className="font-semibold">{t.campaign.title}</span>
            {objectives.length > 0 && (
              <div className="text-xs text-slate-400">
                {fmt(t.campaign.progressInSection, { done: completedCount, total: objectives.length })}
              </div>
            )}
          </div>
          <OverlayCloseButton kind="campaign-panel" />
        </header>

        {locationBanner && (
          <div
            className={`border-b px-4 py-2 text-xs ${
              gameLocation?.status === 'missing_log'
                ? 'border-slate-700 bg-slate-900/50 text-slate-400'
                : 'border-amber-900/40 bg-amber-950/20 text-amber-200'
            }`}
          >
            {locationBanner}
          </div>
        )}

        <nav className="flex flex-wrap gap-1 border-b border-slate-700 px-2 py-2">
          {arcs.map((arc) => {
            const isActiveTab = activeArcId === arc.id
            const isDetectedHere = detectedArcId === arc.id

            return (
              <button
                key={arc.id}
                type="button"
                disabled={!arc.isAvailable}
                className={`relative rounded px-2.5 py-1.5 text-xs ${
                  isActiveTab ? 'tab-active' : 'tab-inactive'
                } ${!arc.isAvailable ? 'opacity-50' : ''} ${
                  isDetectedHere ? 'campaign-tab--detected ring-1 ring-amber-500/60' : ''
                } ${arc.id.startsWith('act5') ? 'font-medium' : ''}`}
                onClick={() => arc.isAvailable && onArcChange(arc.id)}
                title={arc.name}
              >
                {arc.tabLabel}
                {isDetectedHere && (
                  <span
                    className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400"
                    aria-hidden
                  />
                )}
              </button>
            )
          })}
        </nav>

        <div className="flex-1 overflow-y-auto p-4 text-sm">
          {!currentArc?.isAvailable ? (
            <p className="text-center text-slate-400">{t.common.comingSoon}</p>
          ) : objectives.length === 0 ? (
            <p className="text-slate-400">{t.campaign.noObjectives}</p>
          ) : (
            <div className="space-y-6">
              {currentArc.description && (
                <p className="rounded-md border border-slate-700 bg-slate-900/30 px-3 py-2 text-xs leading-relaxed text-slate-400">
                  {currentArc.description}
                </p>
              )}

              {campaign.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-400/90">
                    {fmt(t.campaign.storyProgression, {
                      done: campaign.filter((o) => o.isCompleted).length,
                      total: campaign.length,
                    })}
                  </h3>
                  <ul className="space-y-2">{campaign.map(renderObjective)}</ul>
                </section>
              )}

              {optional.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {fmt(t.campaign.optionalPowerSpikes, {
                      done: optional.filter((o) => o.isCompleted).length,
                      total: optional.length,
                    })}
                  </h3>
                  <ul className="space-y-2">{optional.map(renderObjective)}</ul>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
