import { queryPoeGameWindow, type PoeGameWindowState } from '../lib/poeGameWindow'

export type GameWindowListener = (state: PoeGameWindowState) => void

let pollTimer: ReturnType<typeof setInterval> | null = null
let lastEmitted: PoeGameWindowState = { bounds: null, isForeground: false }
let stableBounds: PoeGameWindowState['bounds'] = null
let missingBoundsTicks = 0

const MISSING_BOUNDS_THRESHOLD = 2

export function getPoeGameWindowState(): PoeGameWindowState {
  return { bounds: stableBounds, isForeground: lastEmitted.isForeground }
}

/** True when the PoE2 client window exists (game is running). */
export function isPoeGameRunning(): boolean {
  return stableBounds !== null
}

export function startGameWindowTracker(listener: GameWindowListener, intervalMs = 750): void {
  stopGameWindowTracker()

  const tick = async () => {
    const state = await queryPoeGameWindow()

    if (state.bounds) {
      missingBoundsTicks = 0
      stableBounds = state.bounds
    } else {
      missingBoundsTicks += 1
      if (missingBoundsTicks >= MISSING_BOUNDS_THRESHOLD) {
        stableBounds = null
      }
    }

    const stableState: PoeGameWindowState = {
      bounds: stableBounds,
      isForeground: state.isForeground,
    }

    const changed =
      stableState.bounds?.x !== lastEmitted.bounds?.x ||
      stableState.bounds?.y !== lastEmitted.bounds?.y ||
      stableState.bounds?.width !== lastEmitted.bounds?.width ||
      stableState.bounds?.height !== lastEmitted.bounds?.height ||
      Boolean(stableState.bounds) !== Boolean(lastEmitted.bounds)

    lastEmitted = stableState
    if (changed) listener(stableState)
  }

  void tick()
  pollTimer = setInterval(() => {
    void tick()
  }, intervalMs)
}

export function stopGameWindowTracker(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  stableBounds = null
  missingBoundsTicks = 0
  lastEmitted = { bounds: null, isForeground: false }
}
