import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface GameWindowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface PoeGameWindowState {
  bounds: GameWindowBounds | null
  /** True when the PoE2 client window is the active foreground window. */
  isForeground: boolean
}

/** PoE2 client executables (not browsers or other apps with similar page titles). */
const POE2_PROCESS_NAMES = ['PathOfExile', 'PathOfExileSteam', 'PathOfExile_x64', 'PathOfExile_KG'] as const

const POE2_INSTALL_PATH_MARKER = '\\Path of Exile 2\\'
const POE2_WINDOW_TITLE_MARKER = 'Path of Exile 2'

const MIN_GAME_WIDTH = 320
const MIN_GAME_HEIGHT = 240

/**
 * Locates the PoE2 client window on Windows and returns its screen bounds.
 * Matches only known game executables under a PoE2 install path (or same exe + PoE2 title).
 * Returns null when the game is not running or has no visible main window.
 */
export async function queryPoeGameWindow(): Promise<PoeGameWindowState> {
  if (process.platform !== 'win32') {
    return { bounds: null, isForeground: false }
  }

  const allowedNames = POE2_PROCESS_NAMES.map((n) => `'${n}'`).join(', ')

  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class HagaWin32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [StructLayout(LayoutKind.Sequential)] public struct RECT {
    public int Left; public int Top; public int Right; public int Bottom;
  }
}
"@

$allowed = @(${allowedNames})
$installMarker = '${POE2_INSTALL_PATH_MARKER.replace(/\\/g, '\\\\')}'
$titleMarker = '${POE2_WINDOW_TITLE_MARKER}'

function Test-Poe2Process($proc) {
  if (-not $proc -or $proc.MainWindowHandle -eq 0) { return $false }
  if ($proc.ProcessName -notin $allowed) { return $false }
  return $true
}

function Test-Poe2InstallPath($path) {
  if (-not $path) { return $false }
  return $path -like "*$installMarker*"
}

$candidates = Get-Process | Where-Object { Test-Poe2Process $_ }

$proc = $candidates | Where-Object { Test-Poe2InstallPath $_.Path } | Select-Object -First 1

if (-not $proc) {
  $proc = $candidates | Where-Object {
    $_.MainWindowTitle -like "*$titleMarker*"
  } | Select-Object -First 1
}

if (-not $proc) { exit 0 }

$rect = New-Object HagaWin32+RECT
[void][HagaWin32]::GetWindowRect($proc.MainWindowHandle, [ref]$rect)
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top
if ($width -lt ${MIN_GAME_WIDTH} -or $height -lt ${MIN_GAME_HEIGHT}) { exit 0 }

$foreground = [HagaWin32]::GetForegroundWindow()
$isForeground = ($foreground -eq $proc.MainWindowHandle)
Write-Output "$($rect.Left),$($rect.Top),$width,$height,$isForeground"
`.trim()

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: 4000, windowsHide: true },
    )

    const line = stdout.trim()
    if (!line) return { bounds: null, isForeground: false }

    const parts = line.split(',')
    const x = Number(parts[0])
    const y = Number(parts[1])
    const width = Number(parts[2])
    const height = Number(parts[3])
    const isForeground = parts[4]?.toLowerCase() === 'true'

    if (!Number.isFinite(x) || !Number.isFinite(y) || !width || !height) {
      return { bounds: null, isForeground: false }
    }

    return {
      bounds: { x, y, width, height },
      isForeground,
    }
  } catch {
    return { bounds: null, isForeground: false }
  }
}
