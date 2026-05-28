export function DevToolsRailWindow() {
  return (
    <div className="dev-tools-rail">
      <button
        type="button"
        className="dev-tools-rail__btn"
        title="Location capture"
        aria-label="Open location capture"
        onClick={() => window.haga.openDevLocationModal()}
      >
        Loc
      </button>
      <button
        type="button"
        className="dev-tools-rail__btn"
        title="Leveling box"
        aria-label="Open leveling box"
        onClick={() => window.haga.openDevLevelBox()}
      >
        Lvl
      </button>
    </div>
  )
}
