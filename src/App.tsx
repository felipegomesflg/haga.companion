import { useEffect } from 'react'
import { HudWindow } from './windows/HudWindow'
import { BuildPanelWindow } from './windows/BuildPanelWindow'
import { CampaignPanelWindow } from './windows/CampaignPanelWindow'
import { DevToolsRailWindow } from './windows/DevToolsRailWindow'
import { DevLocationModalWindow } from './windows/DevLocationModalWindow'
import { DevLevelBoxWindow } from './windows/DevLevelBoxWindow'
import { GemUnlockToastWindow } from './windows/GemUnlockToastWindow'
import { SettingsWindow } from './windows/SettingsWindow'
import { AboutWindow } from './windows/AboutWindow'
import { SplashWindow } from './windows/SplashWindow'

function getWindowKind(): string {
  const hash = window.location.hash.replace(/^#/, '')
  const params = new URLSearchParams(hash)
  return params.get('window') ?? 'hud'
}

export default function App() {
  const kind = getWindowKind()

  useEffect(() => {
    const isSettings = kind === 'settings'
    const isAbout = kind === 'about'
    const isSplash = kind === 'splash'
    document.documentElement.classList.toggle('desktop-window', isSettings || isSplash)
    document.documentElement.classList.toggle('desktop-window-fit', isAbout)
    document.body.classList.toggle('desktop-window', isSettings || isSplash)
    document.body.classList.toggle('desktop-window-fit', isAbout)
    return () => {
      document.documentElement.classList.remove('desktop-window', 'desktop-window-fit')
      document.body.classList.remove('desktop-window', 'desktop-window-fit')
    }
  }, [kind])

  switch (kind) {
    case 'splash':
      return <SplashWindow />
    case 'build-panel':
      return <BuildPanelWindow />
    case 'campaign-panel':
      return <CampaignPanelWindow />
    case 'dev-tools-rail':
      return <DevToolsRailWindow />
    case 'dev-location-modal':
      return <DevLocationModalWindow />
    case 'dev-level-box':
      return <DevLevelBoxWindow />
    case 'gem-toast':
      return <GemUnlockToastWindow />
    case 'settings':
      return <SettingsWindow />
    case 'about':
      return <AboutWindow />
    case 'hud':
    default:
      return <HudWindow />
  }
}
