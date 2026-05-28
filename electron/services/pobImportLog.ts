const LOG_PREFIX = '[pob-import]'

export function pobImportLog(message: string, data?: unknown): void {
  if (data === undefined) {
    console.log(LOG_PREFIX, message)
    return
  }
  console.log(LOG_PREFIX, message, data)
}

export function pobImportSection(title: string): void {
  console.log(`${LOG_PREFIX} ── ${title} ──`)
}

export function pobImportWarn(message: string, data?: unknown): void {
  if (data === undefined) {
    console.warn(LOG_PREFIX, message)
    return
  }
  console.warn(LOG_PREFIX, message, data)
}

export function pobImportStructure(label: string, value: unknown): void {
  console.log(`${LOG_PREFIX} ${label}:\n${JSON.stringify(value, null, 2)}`)
}
