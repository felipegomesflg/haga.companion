import { useState, type FormEvent } from 'react'
import type { GameLocationState } from '../types/build'

interface Props {
  characterLevel: number | null
  location: GameLocationState | null
  onTriggered?: () => void
}

function levelCaptureHint(location: GameLocationState | null): string | null {
  if (location?.characterLevel != null) return null

  if (location?.status === 'missing_log') {
    return 'Client.txt not found. Open Settings and set the log path (usually Documents/My Games/Path of Exile 2/logs/Client.txt).'
  }

  if (location?.status !== 'watching') {
    return 'Waiting for game log…'
  }

  return 'Level is detected automatically from the game log while you play. Set your character name in the build to ignore party level-ups.'
}

export function DevLevelTriggerForm({ characterLevel, location, onTriggered }: Props) {
  const [levelInput, setLevelInput] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resetting, setResetting] = useState(false)

  const reset = async () => {
    setError('')
    setMessage('')
    setResetting(true)

    try {
      await window.haga.resetCharacterLevel()
      setMessage('Character level restored from game log.')
      onTriggered?.()
    } finally {
      setResetting(false)
    }
  }

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()

    const parsed = Number.parseInt(levelInput.trim(), 10)
    if (!Number.isFinite(parsed) || parsed < 1) {
      setError('Enter a valid level (1+).')
      setMessage('')
      return
    }

    setError('')
    setSubmitting(true)

    try {
      const triggered = await window.haga.debugTriggerLevelUp(parsed)
      setLevelInput('')
      if (triggered.length === 0) {
        setMessage(`Level ${parsed}: no gems unlock at this exact level.`)
      } else {
        const names = triggered.map((gem) => gem.gemName).join(', ')
        setMessage(`Level ${parsed}: ${names}`)
      }
      onTriggered?.()
    } finally {
      setSubmitting(false)
    }
  }

  const captureHint = levelCaptureHint(location)

  return (
    <form className="dev-level-box__trigger" onSubmit={submit}>
      <div className="dev-level-box__meta">
        <span className="dev-level-box__meta-label">Character level</span>
        <span className="dev-level-box__meta-value">
          {characterLevel ?? '—'}
          {location?.levelSource ? ` (${location.levelSource})` : ''}
        </span>
      </div>

      {captureHint && <p className="dev-level-box__hint">{captureHint}</p>}

      <label className="dev-level-box__field">
        <span className="dev-level-box__field-label">Set level</span>
        <div className="dev-level-box__field-row">
          <input
            type="number"
            min={1}
            step={1}
            className="dev-level-box__input"
            placeholder="e.g. 12"
            value={levelInput}
            disabled={submitting}
            onChange={(event) => setLevelInput(event.target.value)}
          />
          <button type="submit" className="dev-level-box__submit" disabled={submitting || resetting || !levelInput.trim()}>
            {submitting ? '…' : 'Trigger'}
          </button>
          <button
            type="button"
            className="dev-level-box__reset"
            disabled={submitting || resetting}
            title="Clear saved level and re-read from game log"
            onClick={() => void reset()}
          >
            {resetting ? '…' : 'Reset'}
          </button>
        </div>
      </label>

      {error && <p className="dev-level-box__error">{error}</p>}
      {message && <p className="dev-level-box__message">{message}</p>}
    </form>
  )
}
