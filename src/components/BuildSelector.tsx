interface Props {
  profiles: Array<{ id: string; name: string }>
  selectedId: string
  draftName: string
  isEditingName: boolean
  isDirty: boolean
  saving: boolean
  onSelect: (id: string) => void
  onDraftNameChange: (name: string) => void
  onToggleEditName: () => void
  onNewBuild: () => void
  onSave: () => void
}

export function BuildSelector({
  profiles,
  selectedId,
  draftName,
  isEditingName,
  isDirty,
  saving,
  onSelect,
  onDraftNameChange,
  onToggleEditName,
  onNewBuild,
  onSave,
}: Props) {
  return (
    <div className="build-selector min-w-0 flex-1">
      <div className="text-xs uppercase tracking-wide text-slate-400">Build</div>
      <div className="build-selector__row">
        <select
          className="build-selector__select"
          value={selectedId}
          disabled={saving}
          onChange={(e) => onSelect(e.target.value)}
        >
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`build-selector__action ${isEditingName ? 'build-selector__action--active' : ''}`}
          title="Edit build name"
          aria-label="Edit build name"
          aria-pressed={isEditingName}
          disabled={saving}
          onClick={onToggleEditName}
        >
          ✎
        </button>
        <button
          type="button"
          className="build-selector__action build-selector__action--add"
          title="Create new build"
          aria-label="Create new build"
          disabled={saving}
          onClick={onNewBuild}
        >
          +
        </button>
      </div>

      {isEditingName && (
        <label className="build-selector__name-field">
          Build name
          <input
            className="build-selector__dialog-input"
            value={draftName}
            disabled={saving}
            onChange={(e) => onDraftNameChange(e.target.value)}
          />
        </label>
      )}

      <button
        type="button"
        className="build-selector__save btn-primary text-xs"
        disabled={saving || !isDirty}
        onClick={onSave}
      >
        {saving ? 'Saving…' : isDirty ? 'Save build' : 'Saved'}
      </button>
    </div>
  )
}
