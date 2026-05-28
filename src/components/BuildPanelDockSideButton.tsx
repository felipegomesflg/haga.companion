interface Props {
  dockSide: 'left' | 'right'
  onClick: () => void
}

export function BuildPanelDockSideButton({ dockSide, onClick }: Props) {
  const onRight = dockSide === 'right'

  return (
    <button
      type="button"
      className="build-panel-dock-btn"
      aria-label={onRight ? 'Move build panel to the left' : 'Move build panel to the right'}
      title={onRight ? 'Dock panel on the left' : 'Dock panel on the right'}
      onClick={onClick}
    >
      {onRight ? '⇤' : '⇥'}
    </button>
  )
}
