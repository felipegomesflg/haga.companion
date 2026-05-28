import { gemColorBorderClass, gemColorTextClass } from '../lib/gemColors'

interface Props {
  name: string
  color: string | null | undefined
  unknown?: boolean
  variant?: 'text' | 'border'
  className?: string
}

export function GemName({
  name,
  color,
  unknown = false,
  variant = 'text',
  className = '',
}: Props) {
  const colorClass = unknown
    ? 'gem-color--unknown'
    : variant === 'border'
      ? gemColorBorderClass(color)
      : gemColorTextClass(color)
  return <span className={`gem-name ${colorClass} ${className}`.trim()}>{name}</span>
}
