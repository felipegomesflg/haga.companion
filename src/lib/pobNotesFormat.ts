const GREEN_OPEN = '[green]'
const GREEN_CLOSE = '[/green]'

export function formatPoBItemNotes(implicitMods: string[], explicitMods: string[]): string {
  const parts: string[] = []
  if (implicitMods.length > 0) {
    parts.push(GREEN_OPEN, ...implicitMods, GREEN_CLOSE)
  }
  if (explicitMods.length > 0) {
    if (parts.length > 0) parts.push('')
    parts.push(...explicitMods)
  }
  return parts.join('\n').trim()
}

export type PoBNotesSegment = { kind: 'implicit' | 'text'; lines: string[] }

export function parsePoBNotesSegments(notes: string): PoBNotesSegment[] {
  const segments: PoBNotesSegment[] = []
  let remaining = notes
  while (remaining.length > 0) {
    const start = remaining.indexOf(GREEN_OPEN)
    if (start === -1) {
      const text = remaining.trim()
      if (text) segments.push({ kind: 'text', lines: text.split('\n') })
      break
    }
    if (start > 0) {
      const before = remaining.slice(0, start).trim()
      if (before) segments.push({ kind: 'text', lines: before.split('\n') })
    }
    remaining = remaining.slice(start + GREEN_OPEN.length)
    const end = remaining.indexOf(GREEN_CLOSE)
    if (end === -1) {
      const implicit = remaining.trim()
      if (implicit) segments.push({ kind: 'implicit', lines: implicit.split('\n') })
      break
    }
    const implicit = remaining.slice(0, end).trim()
    if (implicit) segments.push({ kind: 'implicit', lines: implicit.split('\n') })
    remaining = remaining.slice(end + GREEN_CLOSE.length)
  }
  return segments
}
