import { useCallback, useEffect, useState } from 'react'
import { DevModalShell } from '../components/DevModalShell'
import { HudLocationDebug } from '../components/HudLocationDebug'
import type { GameLocationState, HudState } from '../types/build'

export function DevLocationModalWindow() {
  const [location, setLocation] = useState<GameLocationState | null>(null)
  const [hudState, setHudState] = useState<HudState>({ objective: null, expectedZoneName: null })
  const refresh = useCallback(async () => {
    const [nextLocation, nextHud] = await Promise.all([
      window.haga.getGameLocation(),
      window.haga.getHudState(),
    ])
    setLocation(nextLocation)
    setHudState(nextHud)
  }, [])

  useEffect(() => {
    void refresh()

    const onLocationUpdated = () => refresh()
    window.addEventListener('haga:gameLocationUpdated', onLocationUpdated)
    window.addEventListener('haga:hudUpdated', onLocationUpdated)
    return () => {
      window.removeEventListener('haga:gameLocationUpdated', onLocationUpdated)
      window.removeEventListener('haga:hudUpdated', onLocationUpdated)
    }
  }, [refresh])

  return (
    <DevModalShell title="Location capture" onClose={() => window.haga.closeOverlay('dev-location-modal')}>
      <HudLocationDebug
        location={location}
        expectedZoneName={hudState.expectedZoneName}
        objectiveTitle={hudState.objective?.title ?? null}
      />
    </DevModalShell>
  )
}
