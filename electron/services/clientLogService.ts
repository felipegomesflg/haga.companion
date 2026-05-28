import fs from 'node:fs'
import { discoverClientLogPath } from '../lib/clientLogPath'
import { resolveAreaMatch } from '../lib/zoneArcMap'
import { getSetting, getUserDb } from '../db/userDb'
import * as objectiveService from './objectiveService'
import { handleCharacterLevelUp } from './gemUnlockService'
import {
  clearTrackedCharacterLevel,
  getActiveCharacterTracking,
  persistTrackedCharacterLevel,
  shouldAcceptCharacterLevel,
} from './characterLevelService'
import type { GameLocationState } from '../../src/types/build'

const AREA_ENTERED_MARKERS = [
  ']: You have entered ',
  ']: Você entrou em ',
  ']: Voce entrou em ',
  ']: Entrou em ',
]

const AREA_ENTERED_REGEXES = [
  /]: You have entered (.+?)\.\s*$/i,
  /]: Você entrou em (.+?)\.\s*$/i,
  /]: Voce entrou em (.+?)\.\s*$/i,
  /]: Entrou em (.+?)\.\s*$/i,
  /You have entered (.+?)\.\s*$/i,
]

const SCENE_AREA_REGEX = /\[SCENE\] Set Source \[(.+?)\]/i

const IGNORED_SCENE_AREAS = new Set(['(null)', '(unknown)', 'Interlude'])

const WHOIS_LINE_PATTERNS = [
  // /whois Name — ": Name is a level 12 Mercenary in the Acts"
  /\]\s*:\s*(.+?) is a level (\d+)/i,
  // /whois Name — ": Name is level 12 ..."
  /\]\s*:\s*(.+?) is level (\d+)/i,
  // /whois (self) — ": You are a level 12 Mercenary in the Acts"
  /\]\s*:\s*You are a level (\d+)/i,
  /\]\s*:\s*You are level (\d+)/i,
  /\]\s*:\s*Você é level (\d+)/i,
  /\]\s*:\s*Voce e level (\d+)/i,
]

type LevelCaptureSource = 'level_up' | 'whois' | 'saved'

type ParsedCharacterLevel = {
  level: number
  source: LevelCaptureSource
  characterName: string | null
  selfWhois: boolean
}

const TAIL_SCAN_BYTES = 10_000_000
const POLL_INTERVAL_MS = 750

export type GameLocationListener = (state: GameLocationState) => void

let pollTimer: ReturnType<typeof setInterval> | null = null
let readOffset = 0
let activeLogPath: string | null = null
let listener: GameLocationListener | null = null
let levelInitialized = false

let currentState: GameLocationState = {
  status: 'idle',
  areaName: null,
  areaInstanceId: null,
  arcId: null,
  actNumber: null,
  arcTabLabel: null,
  characterName: null,
  characterLevel: null,
  levelSource: null,
  lastLevelLine: null,
  matchType: null,
  matchedZoneName: null,
  lastAreaLine: null,
  captureSource: null,
  logPath: null,
  updatedAt: null,
}

function isAutoDetectEnabled(): boolean {
  return getSetting(getUserDb(), 'campaignAutoDetectAct') !== 'false'
}

function buildState(partial: Partial<GameLocationState>): GameLocationState {
  return { ...currentState, ...partial }
}

function enrichArc(state: GameLocationState): GameLocationState {
  if (!state.arcId) {
    return { ...state, actNumber: null, arcTabLabel: null }
  }

  const arc = objectiveService.getCampaignArcs().find((entry) => entry.id === state.arcId)
  return {
    ...state,
    actNumber: arc?.actNumber ?? null,
    arcTabLabel: arc?.tabLabel ?? null,
  }
}

function emit(next: GameLocationState): void {
  const enriched = enrichArc(next)
  const changed =
    enriched.status !== currentState.status ||
    enriched.areaName !== currentState.areaName ||
    enriched.areaInstanceId !== currentState.areaInstanceId ||
    enriched.arcId !== currentState.arcId ||
    enriched.characterName !== currentState.characterName ||
    enriched.characterLevel !== currentState.characterLevel ||
    enriched.levelSource !== currentState.levelSource ||
    enriched.lastLevelLine !== currentState.lastLevelLine ||
    enriched.matchType !== currentState.matchType ||
    enriched.matchedZoneName !== currentState.matchedZoneName ||
    enriched.lastAreaLine !== currentState.lastAreaLine ||
    enriched.captureSource !== currentState.captureSource ||
    enriched.logPath !== currentState.logPath

  currentState = enriched
  if (changed) listener?.(currentState)
}

export function getGameLocationState(): GameLocationState {
  return currentState
}

export function reloadCharacterLevelFromBuild(): void {
  const tracking = getActiveCharacterTracking()
  if (!tracking) {
    emit(
      buildState({
        characterName: null,
        characterLevel: null,
        levelSource: null,
        lastLevelLine: null,
      }),
    )
    return
  }

  if (currentState.levelSource === 'level_up' || currentState.levelSource === 'whois') {
    emit(
      buildState({
        characterName: tracking.gameCharacterName ?? currentState.characterName,
      }),
    )
    return
  }

  if (tracking.trackedCharacterLevel === null) {
    emit(
      buildState({
        characterName: tracking.gameCharacterName,
        characterLevel: null,
        levelSource: null,
      }),
    )
    return
  }

  emit(
    buildState({
      characterName: tracking.gameCharacterName,
      characterLevel: tracking.trackedCharacterLevel,
      levelSource: 'saved',
      updatedAt: new Date().toISOString(),
    }),
  )
}

function readLogTail(logPath: string, maxBytes = TAIL_SCAN_BYTES): string | null {
  let stat: fs.Stats
  try {
    stat = fs.statSync(logPath)
  } catch {
    return null
  }

  const start = Math.max(0, stat.size - maxBytes)
  const length = stat.size - start
  if (length <= 0) return null

  const fd = fs.openSync(logPath, 'r')
  try {
    const buffer = Buffer.alloc(length)
    fs.readSync(fd, buffer, 0, length, start)
    return buffer.toString('utf8')
  } finally {
    fs.closeSync(fd)
  }
}

type LevelCandidate = {
  parsed: ParsedCharacterLevel
  line: string
  index: number
}

function pickBestLevelCandidate(
  candidates: LevelCandidate[],
  tracking: ReturnType<typeof getActiveCharacterTracking>,
): LevelCandidate | null {
  if (candidates.length === 0) return null

  if (tracking?.gameCharacterName) {
    return candidates.reduce<LevelCandidate | null>(
      (best, candidate) => (!best || candidate.parsed.level > best.parsed.level ? candidate : best),
      null,
    )
  }

  const selfCandidates = candidates.filter((candidate) => candidate.parsed.selfWhois)
  if (selfCandidates.length > 0) {
    return selfCandidates[selfCandidates.length - 1] ?? null
  }

  const byName = new Map<string, LevelCandidate>()
  for (const candidate of candidates) {
    if (!candidate.parsed.characterName) continue
    const key = candidate.parsed.characterName.toLowerCase()
    const previous = byName.get(key)
    if (
      !previous ||
      candidate.parsed.level > previous.parsed.level ||
      (candidate.parsed.level === previous.parsed.level && candidate.index > previous.index)
    ) {
      byName.set(key, candidate)
    }
  }

  if (byName.size === 0) return null

  return [...byName.values()].reduce<LevelCandidate | null>(
    (best, candidate) => (!best || candidate.parsed.level > best.parsed.level ? candidate : best),
    null,
  )
}

function captureBestLevelFromLog(logPath: string): boolean {
  const chunk = readLogTail(logPath)
  if (!chunk) return false

  const tracking = getActiveCharacterTracking()
  const lines = chunk.split(/\r?\n/)
  const candidates: LevelCandidate[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const parsed = parseCharacterLevelFromLine(line)
    if (!parsed) continue

    const gate = shouldAcceptCharacterLevel(tracking, parsed.characterName, {
      selfWhois: parsed.selfWhois,
      historical: true,
    })
    if (!gate.accept) continue

    candidates.push({ parsed, line, index })
  }

  const best = pickBestLevelCandidate(candidates, tracking)
  if (!best) return false

  handleLevelChange(best.parsed, best.line, { startup: true, historical: true })
  return true
}

function tryCaptureLevelFromLog(logPath: string): void {
  if (currentState.levelSource === 'level_up' || currentState.levelSource === 'whois') return
  captureBestLevelFromLog(logPath)
}

function restoreLastLevelFromLog(logPath: string): boolean {
  return captureBestLevelFromLog(logPath)
}

export function resetCharacterLevelFromLog(): GameLocationState {
  const tracking = getActiveCharacterTracking()
  if (tracking) {
    clearTrackedCharacterLevel(tracking.buildId)
  }

  const customPath = getSetting(getUserDb(), 'clientLogPath')
  const logPath = activeLogPath ?? discoverClientLogPath(customPath)
  if (logPath && restoreLastLevelFromLog(logPath)) {
    return currentState
  }

  emit(
    buildState({
      characterLevel: null,
      levelSource: null,
      lastLevelLine: null,
      characterName: tracking?.gameCharacterName ?? currentState.characterName,
    }),
  )

  return currentState
}

function shouldIgnoreSceneArea(name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return true
  if (IGNORED_SCENE_AREAS.has(trimmed)) return true
  if (/^Act \d+$/i.test(trimmed)) return true
  return false
}

function parseSceneAreaFromLine(line: string): string | null {
  const match = line.match(SCENE_AREA_REGEX)
  if (!match?.[1]) return null
  const areaName = match[1].trim()
  if (shouldIgnoreSceneArea(areaName)) return null
  return areaName
}

function parseAreaFromLine(line: string): { areaName: string; source: 'scene' | 'entered' } | null {
  const sceneArea = parseSceneAreaFromLine(line)
  if (sceneArea) return { areaName: sceneArea, source: 'scene' }

  for (const pattern of AREA_ENTERED_REGEXES) {
    const match = line.match(pattern)
    if (match?.[1]) return { areaName: match[1].trim(), source: 'entered' }
  }

  for (const marker of AREA_ENTERED_MARKERS) {
    const idx = line.indexOf(marker)
    if (idx === -1) continue

    const start = idx + marker.length
    const dotIdx = line.indexOf('.', start)
    const areaName = dotIdx > start ? line.slice(start, dotIdx).trim() : line.slice(start).trim()
    if (areaName) return { areaName, source: 'entered' }
  }

  return null
}

function parseLevelUpFromLine(line: string): ParsedCharacterLevel | null {
  const namedPatterns = [
    /\]\s*:\s*(.+?) \(.+?\) is now level (\d+)/i,
    /\]\s*:\s*(.+?) \(.+?\) has reached level (\d+)/i,
  ]

  for (const pattern of namedPatterns) {
    const namedMatch = line.match(pattern)
    if (!namedMatch?.[1] || !namedMatch[2]) continue

    const level = Number(namedMatch[2])
    if (!Number.isFinite(level) || level <= 0 || level > 100) continue

    return {
      level,
      source: 'level_up',
      characterName: namedMatch[1].trim(),
      selfWhois: false,
    }
  }

  const selfPatterns = [
    /\]\s*:\s*You are now level (\d+)/i,
    /\]\s*:\s*You have reached level (\d+)/i,
    /\]\s*:\s*Você alcançou o nível (\d+)/i,
    /\]\s*:\s*Voce alcancou o nivel (\d+)/i,
    /\]\s*:\s*Agora você está no nível (\d+)/i,
    /\]\s*:\s*Agora voce esta no nivel (\d+)/i,
  ]

  for (const pattern of selfPatterns) {
    const match = line.match(pattern)
    if (!match?.[1]) continue
    const level = Number(match[1])
    if (!Number.isFinite(level) || level <= 0 || level > 100) continue
    return { level, source: 'level_up', characterName: null, selfWhois: true }
  }

  return null
}

function parseWhoisFromLine(line: string): ParsedCharacterLevel | null {
  for (const pattern of WHOIS_LINE_PATTERNS) {
    const match = line.match(pattern)
    if (!match?.[1]) continue

    const level = Number(match[match.length - 1])
    if (!Number.isFinite(level) || level <= 0 || level > 100) continue

    const selfWhois = /^you are|^você é|^voce e/i.test(match[0])
    const characterName = selfWhois ? null : match[1]?.trim() || null
    return { level, source: 'whois', characterName, selfWhois }
  }

  return null
}

function parseCharacterLevelFromLine(line: string): ParsedCharacterLevel | null {
  return parseLevelUpFromLine(line) ?? parseWhoisFromLine(line)
}

function handleLevelChange(
  parsed: ParsedCharacterLevel,
  sourceLine: string,
  options: { startup?: boolean; historical?: boolean } = {},
): void {
  const tracking = getActiveCharacterTracking()
  const gate = shouldAcceptCharacterLevel(tracking, parsed.characterName, {
    selfWhois: parsed.selfWhois,
    historical: options.historical,
  })
  if (!gate.accept) return

  const previousLevel = currentState.characterLevel
  const inferredName =
    !tracking?.gameCharacterName && parsed.characterName && (options.historical || gate.persistName)
      ? parsed.characterName
      : null
  const nextCharacterName =
    gate.persistName ?? tracking?.gameCharacterName ?? inferredName ?? parsed.characterName

  emit(
    buildState({
      characterName: nextCharacterName,
      characterLevel: parsed.level,
      levelSource: parsed.source,
      lastLevelLine: sourceLine.trim(),
      updatedAt: new Date().toISOString(),
    }),
  )

  if (tracking) {
    persistTrackedCharacterLevel(tracking.buildId, parsed.level, {
      gameCharacterName: gate.persistName ?? inferredName ?? undefined,
    })
  }

  if (parsed.source !== 'level_up' || options.startup) return

  if (!levelInitialized) {
    levelInitialized = true
    return
  }

  if (previousLevel !== null && parsed.level > previousLevel) {
    handleCharacterLevelUp(previousLevel, parsed.level)
  }
}

function handleAreaEntered(areaName: string, sourceLine: string, source: 'scene' | 'entered'): void {
  const match = resolveAreaMatch(areaName)
  emit(
    buildState({
      status: 'watching',
      areaName,
      areaInstanceId: areaName,
      lastAreaLine: sourceLine.trim(),
      captureSource: source,
      arcId: match.arcId,
      matchType: match.matchType,
      matchedZoneName: match.matchedZoneName,
      updatedAt: new Date().toISOString(),
    }),
  )

  if (activeLogPath) {
    tryCaptureLevelFromLog(activeLogPath)
  }
}

function processChunk(
  chunk: string,
  options: { startup?: boolean; parseAreas?: boolean } = {},
): void {
  const parseAreas = options.parseAreas ?? isAutoDetectEnabled()
  const lines = chunk.split(/\r?\n/)
  for (const line of lines) {
    if (parseAreas) {
      const parsedArea = parseAreaFromLine(line)
      if (parsedArea) handleAreaEntered(parsedArea.areaName, line, parsedArea.source)
    }

    const parsedLevel = parseCharacterLevelFromLine(line)
    if (parsedLevel) handleLevelChange(parsedLevel, line, options)
  }
}

function scanTail(logPath: string, options: { parseAreas?: boolean } = {}): void {
  let stat: fs.Stats
  try {
    stat = fs.statSync(logPath)
  } catch {
    return
  }

  const start = Math.max(0, stat.size - TAIL_SCAN_BYTES)
  const length = stat.size - start
  if (length <= 0) {
    readOffset = stat.size
    tryCaptureLevelFromLog(logPath)
    return
  }

  const fd = fs.openSync(logPath, 'r')
  try {
    const buffer = Buffer.alloc(length)
    fs.readSync(fd, buffer, 0, length, start)
    processChunk(buffer.toString('utf8'), { startup: true, parseAreas: options.parseAreas })
  } finally {
    fs.closeSync(fd)
  }

  readOffset = stat.size
  tryCaptureLevelFromLog(logPath)
}

function pollLogFile(): void {
  const customPath = getSetting(getUserDb(), 'clientLogPath')
  const logPath = discoverClientLogPath(customPath)
  const parseAreas = isAutoDetectEnabled()

  if (!logPath) {
    activeLogPath = null
    readOffset = 0
    emit(
      buildState({
        status: 'missing_log',
        areaName: null,
        areaInstanceId: null,
        arcId: null,
        characterName: null,
        characterLevel: null,
        levelSource: null,
        lastLevelLine: null,
        matchType: null,
        matchedZoneName: null,
        lastAreaLine: null,
        logPath: customPath?.trim() || null,
      }),
    )
    return
  }

  if (logPath !== activeLogPath) {
    activeLogPath = logPath
    readOffset = 0
    reloadCharacterLevelFromBuild()
    scanTail(logPath, { parseAreas })
    emit(buildState({ status: 'watching', logPath }))
    return
  }

  let stat: fs.Stats
  try {
    stat = fs.statSync(logPath)
  } catch {
    activeLogPath = null
    readOffset = 0
    emit(buildState({ status: 'missing_log', logPath: null }))
    return
  }

  if (stat.size < readOffset) readOffset = 0
  if (stat.size === readOffset) return

  const length = stat.size - readOffset
  const fd = fs.openSync(logPath, 'r')
  try {
    const buffer = Buffer.alloc(length)
    fs.readSync(fd, buffer, 0, length, readOffset)
    processChunk(buffer.toString('utf8'), { parseAreas })
  } finally {
    fs.closeSync(fd)
  }

  readOffset = stat.size
}

export function startClientLogTracker(onChange: GameLocationListener, intervalMs = POLL_INTERVAL_MS): void {
  stopClientLogTracker()
  listener = onChange

  reloadCharacterLevelFromBuild()
  pollLogFile()
  pollTimer = setInterval(pollLogFile, intervalMs)
}

export function stopClientLogTracker(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }

  listener = null
  activeLogPath = null
  readOffset = 0
  levelInitialized = false
  currentState = {
    status: 'idle',
    areaName: null,
    areaInstanceId: null,
    arcId: null,
    actNumber: null,
    arcTabLabel: null,
    characterName: null,
    characterLevel: null,
    levelSource: null,
    lastLevelLine: null,
    matchType: null,
    matchedZoneName: null,
    lastAreaLine: null,
    captureSource: null,
    logPath: null,
    updatedAt: null,
  }
}

export function refreshClientLogTracker(): void {
  activeLogPath = null
  readOffset = 0
  reloadCharacterLevelFromBuild()
  pollLogFile()
}
