export function nextTempPageName(existingTitles: string[], prefix = 'New'): string {
  for (let i = 1; i < 1000; i++) {
    const candidate = `${prefix} ${i}`
    if (!existingTitles.includes(candidate)) return candidate
  }
  return `${prefix} ${Date.now()}`
}
