type OverlayCloseKind = 'hud' | 'build-panel' | 'campaign-panel'

interface OverlayCloseButtonProps {
  kind: OverlayCloseKind
}

export function OverlayCloseButton({ kind }: OverlayCloseButtonProps) {
  const isMinimize = kind === 'build-panel'
  return (
    <button
      type="button"
      className="overlay-close-btn"
      aria-label={isMinimize ? 'Minimize' : 'Close'}
      title={isMinimize ? 'Minimize' : 'Close'}
      onClick={() => window.haga.closeOverlay(kind)}
    >
      {isMinimize ? '›' : '×'}
    </button>
  )
}
