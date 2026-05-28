import { useMemo } from 'react'
import type { GameLocationState } from '../types/build'
import { zonesMatchExpected } from '../lib/zoneMatch'

interface Props {
  location: GameLocationState | null
  expectedZoneName?: string | null
  objectiveTitle?: string | null
}

function statusLabel(status: GameLocationState['status'] | undefined): string {
  if (status === 'watching') return 'Watching Client.txt'
  if (status === 'missing_log') return 'Log not found'
  return 'Idle'
}

export function HudLocationDebug({ location, expectedZoneName, objectiveTitle }: Props) {
  const currentArea = location?.areaName ?? null

  const zoneMatchesObjective = useMemo(
    () => zonesMatchExpected(currentArea, expectedZoneName ?? null),
    [currentArea, expectedZoneName],
  )

  return (
    <section className="hud-location-debug">
      <div className="hud-location-debug__header">
        <span className="hud-location-debug__title">Location capture</span>
        <span className={`hud-location-debug__status hud-location-debug__status--${location?.status ?? 'idle'}`}>
          {statusLabel(location?.status)}
        </span>
      </div>

      <dl className="hud-location-debug__grid">
        <div>
          <dt>Log file</dt>
          <dd>{location?.logPath ?? '—'}</dd>
        </div>
        <div>
          <dt>Capture source</dt>
          <dd>{location?.captureSource ?? '—'}</dd>
        </div>
        <div>
          <dt>Captured area</dt>
          <dd>{currentArea ?? '—'}</dd>
        </div>
        <div>
          <dt>Instance id</dt>
          <dd>{location?.areaInstanceId ?? '—'}</dd>
        </div>
        <div>
          <dt>Objective expected zone</dt>
          <dd className={zoneMatchesObjective ? 'hud-location-debug__zone--match' : undefined}>
            {expectedZoneName ?? '—'}
          </dd>
        </div>
        {objectiveTitle ? (
          <div>
            <dt>Objective</dt>
            <dd className="hud-location-debug__objective-ref">{objectiveTitle}</dd>
          </div>
        ) : null}
        <div>
          <dt>Resolved act</dt>
          <dd>
            {location?.arcTabLabel ?? location?.arcId ?? '—'}
            {location?.matchType ? ` (${location.matchType})` : ''}
          </dd>
        </div>
        <div>
          <dt>Tracked character</dt>
          <dd>{location?.characterName ?? '—'}</dd>
        </div>
        <div>
          <dt>Character level</dt>
          <dd>
            {location?.characterLevel ?? '—'}
            {location?.levelSource ? ` (${location.levelSource})` : ''}
          </dd>
        </div>
        <div>
          <dt>Last level line</dt>
          <dd className="hud-location-debug__line">{location?.lastLevelLine ?? '—'}</dd>
        </div>
        <div>
          <dt>Last log line</dt>
          <dd className="hud-location-debug__line">{location?.lastAreaLine ?? '—'}</dd>
        </div>
      </dl>
    </section>
  )
}
