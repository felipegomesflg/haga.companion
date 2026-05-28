import { parsePoBNotesSegments } from '../lib/pobNotesFormat'

export function PoBNotesDisplay({ notes }: { notes: string }) {
  const segments = parsePoBNotesSegments(notes.trim())
  if (segments.length === 0) return null

  return (
    <div className="equip-item-tooltip__notes">
      {segments.map((segment, index) =>
        segment.kind === 'implicit' ? (
          <div key={`implicit-${index}`} className="equip-item-tooltip__notes--implicit">
            {segment.lines.join('\n')}
          </div>
        ) : (
          <div key={`text-${index}`}>{segment.lines.join('\n')}</div>
        ),
      )}
    </div>
  )
}
