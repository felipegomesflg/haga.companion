interface Props {
  checked: boolean
  onToggle: (completed: boolean) => void
  className?: string
  title?: string
}

/**
 * Checkbox that does not keep keyboard focus (so WASD still works in PoE2 after toggling).
 */
export function ObjectiveCheckbox({ checked, onToggle, className, title }: Props) {
  return (
    <input
      type="checkbox"
      checked={checked}
      className={className}
      title={title}
      onMouseDown={(event) => event.preventDefault()}
      onChange={(event) => onToggle(event.target.checked)}
    />
  )
}
