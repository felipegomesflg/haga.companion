interface Props {
  maximized: boolean
  onClick: () => void
}

export function BuildPanelMaximizeButton({ maximized, onClick }: Props) {
  return (
    <button
      type="button"
      className="build-panel-maximize-btn"
      aria-label={maximized ? 'Restore build panel height' : 'Maximize build panel height'}
      title={maximized ? 'Restore height' : 'Maximize height'}
      onClick={onClick}
    >
      {maximized ? '⤡' : '⤢'}
    </button>
  )
}
