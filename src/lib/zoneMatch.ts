import { canonicalZoneName, normalizeZoneName } from './zoneCanonical'

export function zonesMatchExpected(capturedArea: string | null, expectedZone: string | null): boolean {
  if (!capturedArea || !expectedZone) return false

  const capturedNorm = normalizeZoneName(canonicalZoneName(capturedArea))
  const expectedParts = expectedZone.split(/\s*\/\s*/)

  return expectedParts.some((part) => {
    const partNorm = normalizeZoneName(canonicalZoneName(part))
    if (!partNorm) return false
    return (
      partNorm === capturedNorm ||
      capturedNorm.includes(partNorm) ||
      partNorm.includes(capturedNorm)
    )
  })
}
