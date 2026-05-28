import { useCallback, useEffect, useMemo, useState } from 'react'
import { ObjectiveCheckbox } from '../components/ObjectiveCheckbox'
import { OverlayCloseButton } from '../components/OverlayCloseButton'
import { useI18n } from '../hooks/useI18n'
import { zonesMatchExpected } from '../lib/zoneMatch'
import type { CampaignArc, CampaignObjective, GameLocationState, HudState } from '../types/build'

export type HudLayoutMode = 'compact' | 'expanded'

function HudDetailsToggle({
  hasDescription,
  layoutMode,
  onToggleDetails,
  hideLabel,
  showLabel,
}: {
  hasDescription: boolean
  layoutMode: HudLayoutMode
  onToggleDetails: () => void
  hideLabel: string
  showLabel: string
}) {
  if (!hasDescription) return null

  const expanded = layoutMode === 'expanded'

  return (
    <button
      type="button"
      className="hud-panel__icon-btn"
      onClick={onToggleDetails}
      title={expanded ? hideLabel : showLabel}
      aria-expanded={expanded}
      aria-label={expanded ? hideLabel : showLabel}
    >
      <svg
        viewBox="0 0 16 16"
        className={`hud-panel__chevron ${expanded ? 'hud-panel__chevron--open' : ''}`}
        aria-hidden
      >
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    </button>
  )
}

function HudOpenCampaignButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="hud-panel__icon-btn"
      onClick={() => window.haga.openCampaignPanel()}
      title={label}
      aria-label={label}
    >
      <svg viewBox="0 0 16 16" className="hud-panel__glyph" aria-hidden>
        <path
          d="M4 4h8v8H4z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

function HudObjectiveBody({ objective, t }: { objective: CampaignObjective; t: ReturnType<typeof useI18n>['t'] }) {
  const typeLabels = t.hud.objectiveTypes

  const objectiveTypeLabel = (type: string | null): string => {
    if (!type) return typeLabels.default
    return typeLabels[type as keyof typeof typeLabels] ?? type
  }

  return (
    <>
      <div className="hud-panel__body-meta">
        {objective.isOptional ? (
          <span className="hud-panel__badge hud-panel__badge--optional">{t.common.optional}</span>
        ) : (
          <span className="hud-panel__badge hud-panel__badge--required">{t.common.required}</span>
        )}
        {objective.objectiveType && (
          <span className="hud-panel__badge hud-panel__badge--type">
            {objectiveTypeLabel(objective.objectiveType)}
          </span>
        )}
      </div>
      {objective.description && (
        <div className="hud-panel__description">{objective.description}</div>
      )}
      {objective.rewardTags && objective.rewardTags.length > 0 && (
        <div className="hud-panel__tags">
          {objective.rewardTags.map((tag) => (
            <span key={tag} className="hud-panel__tag">
              {tag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </>
  )
}

export function HudWindow() {
  const { t } = useI18n()
  const [state, setState] = useState<HudState>({ objective: null, expectedZoneName: null })
  const [arcLabel, setArcLabel] = useState<string | null>(null)
  const [layoutMode, setLayoutMode] = useState<HudLayoutMode>('compact')
  const [gameLocation, setGameLocation] = useState<GameLocationState | null>(null)

  const syncLayoutMode = useCallback(async (mode: HudLayoutMode) => {
    const next = await window.haga.setHudLayoutMode(mode, false)
    setLayoutMode(next === 'maximized' ? 'expanded' : next)
  }, [])

  const refresh = useCallback(async () => {
    const [next, mode] = await Promise.all([window.haga.getHudState(), window.haga.getHudLayoutMode()])
    setState(next)
    setLayoutMode(mode === 'maximized' ? 'expanded' : mode)
    if (next.objective?.arcId) {
      const arcs = await window.haga.getCampaignArcs()
      const arc = arcs.find((a: CampaignArc) => a.id === next.objective?.arcId)
      setArcLabel(arc?.tabLabel ?? null)
    } else {
      setArcLabel(null)
    }
  }, [])

  useEffect(() => {
    refresh()
    const onHudUpdated = () => refresh()
    const onLayoutMode = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      if (detail === 'compact' || detail === 'expanded') setLayoutMode(detail)
      if (detail === 'maximized') setLayoutMode('expanded')
    }
    const refreshLocation = () => {
      void window.haga.getGameLocation().then(setGameLocation)
    }

    refreshLocation()
    window.addEventListener('haga:hudUpdated', onHudUpdated)
    window.addEventListener('haga:hudLayoutMode', onLayoutMode)
    window.addEventListener('haga:gameLocationUpdated', refreshLocation)
    window.addEventListener('haga:localeChanged', onHudUpdated)
    return () => {
      window.removeEventListener('haga:hudUpdated', onHudUpdated)
      window.removeEventListener('haga:hudLayoutMode', onLayoutMode)
      window.removeEventListener('haga:gameLocationUpdated', refreshLocation)
      window.removeEventListener('haga:localeChanged', onHudUpdated)
    }
  }, [refresh])

  const objective = state.objective
  const objectiveId = objective?.id
  const hasDescription = Boolean(objective?.description?.trim())

  useEffect(() => {
    if (!objectiveId) return
    void syncLayoutMode('compact')
  }, [objectiveId, syncLayoutMode])

  const toggleDetails = () => {
    void syncLayoutMode(layoutMode === 'expanded' ? 'compact' : 'expanded')
  }

  const isInExpectedZone = useMemo(
    () => zonesMatchExpected(gameLocation?.areaName ?? null, state.expectedZoneName),
    [gameLocation?.areaName, state.expectedZoneName],
  )

  if (!objective) {
    return (
      <div className="hud-panel-root">
        <div className="overlay-panel hud-panel hud-panel--compact">
          <div className="hud-panel__header">
            <span className="text-sm text-slate-300">{t.hud.allComplete}</span>
            <div className="hud-panel__header-actions">
              <HudOpenCampaignButton label={t.hud.openCampaign} />
              <OverlayCloseButton kind="hud" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const locationLabel = arcLabel ?? `${t.common.act} ${objective.actNumber}`
  const showBody = layoutMode === 'expanded' && hasDescription

  return (
    <div className="hud-panel-root">
      <div
        className={`overlay-panel hud-panel ${showBody ? 'hud-panel--expanded' : 'hud-panel--compact'}${isInExpectedZone ? ' hud-panel--zone-match' : ''}`}
      >
        <div className="hud-panel__header">
          <ObjectiveCheckbox
            checked={objective.isCompleted}
            className="hud-panel__checkbox hud-panel__checkbox--lead"
            title={t.hud.markComplete}
            onToggle={(completed) => {
              void window.haga.toggleObjective(objective.id, completed).then(refresh)
            }}
          />
          <div className="hud-panel__header-text">
            <div className="hud-panel__location">{locationLabel}</div>
            <div className="hud-panel__title">{objective.title}</div>
            {layoutMode === 'compact' && objective.description && (
              <div className="hud-panel__preview">{objective.description.split('\n')[0]}</div>
            )}
          </div>
          <div className="hud-panel__header-actions">
            <HudDetailsToggle
              hasDescription={hasDescription}
              layoutMode={layoutMode}
              onToggleDetails={toggleDetails}
              hideLabel={t.hud.hideDetails}
              showLabel={t.hud.showDetails}
            />
            <HudOpenCampaignButton label={t.hud.openCampaign} />
            <OverlayCloseButton kind="hud" />
          </div>
        </div>
        {showBody && (
          <div className="hud-panel__body">
            <HudObjectiveBody objective={objective} t={t} />
          </div>
        )}
      </div>
    </div>
  )
}
