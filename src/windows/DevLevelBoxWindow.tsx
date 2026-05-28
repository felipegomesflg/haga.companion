import { useCallback, useEffect, useState } from 'react'
import { DevLevelGemList } from '../components/DevLevelGemList'
import { DevLevelTriggerForm } from '../components/DevLevelTriggerForm'
import { DevModalShell } from '../components/DevModalShell'
import type { BuildGemGroup, GameLocationState } from '../types/build'

export function DevLevelBoxWindow() {
  const [characterLevel, setCharacterLevel] = useState<number | null>(null)
  const [location, setLocation] = useState<GameLocationState | null>(null)
  const [groups, setGroups] = useState<BuildGemGroup[]>([])

  const refresh = useCallback(async () => {
    const [build, gameLocation] = await Promise.all([
      window.haga.getActiveBuild(),
      window.haga.getGameLocation(),
    ])

    setLocation(gameLocation)
    setCharacterLevel(gameLocation.characterLevel)

    if (!build) {
      setGroups([])
      return
    }

    setGroups(await window.haga.getBuildGemGroups(build.id))
  }, [])

  useEffect(() => {
    void refresh()

    const onUpdated = () => refresh()
    window.addEventListener('haga:gameLocationUpdated', onUpdated)
    window.addEventListener('haga:activeBuildUpdated', onUpdated)
    return () => {
      window.removeEventListener('haga:gameLocationUpdated', onUpdated)
      window.removeEventListener('haga:activeBuildUpdated', onUpdated)
    }
  }, [refresh])

  return (
    <DevModalShell title="Leveling" onClose={() => window.haga.closeOverlay('dev-level-box')}>
      <div className="dev-level-box">
        <DevLevelTriggerForm characterLevel={characterLevel} location={location} onTriggered={refresh} />
        <div className="dev-level-box__gems">
          <div className="dev-level-box__gems-title">Build gems</div>
          <DevLevelGemList groups={groups} characterLevel={characterLevel} />
        </div>
      </div>
    </DevModalShell>
  )
}
