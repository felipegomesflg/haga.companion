export type BuildPanelDockSide = 'left' | 'right'

interface Props {
  expanded: boolean
  dockSide: BuildPanelDockSide
  onClick: () => void
}

function earStyle(dockSide: BuildPanelDockSide): 'leading' | 'trailing' {
  return dockSide === 'right' ? 'leading' : 'trailing'
}

function earArrow(expanded: boolean, dockSide: BuildPanelDockSide): string {
  if (dockSide === 'right') return expanded ? '›' : '‹'
  return expanded ? '‹' : '›'
}

export function BuildPanelEar({ expanded, dockSide, onClick }: Props) {
  const side = earStyle(dockSide)

  return (
    <button
      type="button"
      className={`build-panel-ear build-panel-ear--${side}`}
      aria-label={expanded ? 'Minimize build panel' : 'Expand build panel'}
      title={expanded ? 'Minimize' : 'Expand'}
      onClick={onClick}
    >
      {earArrow(expanded, dockSide)}
    </button>
  )
}
