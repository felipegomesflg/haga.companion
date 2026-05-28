import { inflateSync, inflateRawSync, gunzipSync } from 'node:zlib'

function normalizePoBShareCode(input: string): string {
  let code = input.trim()
  if (!code) throw new Error('Paste a Path of Building share code.')

  const urlMatch = code.match(/[?&]code=([^&]+)/i)
  if (urlMatch) code = urlMatch[1]

  code = code.replace(/\s/g, '')
  code = code.replace(/-/g, '+').replace(/_/g, '/')
  const pad = code.length % 4
  if (pad) code += '='.repeat(4 - pad)
  return code
}

function decompressPoBPayload(buffer: Buffer): Buffer {
  const attempts: Array<() => Buffer> = [
    () => inflateSync(buffer),
    () => gunzipSync(buffer),
    () => inflateRawSync(buffer),
  ]

  let lastError: unknown
  for (const attempt of attempts) {
    try {
      return attempt()
    } catch (err) {
      lastError = err
    }
  }

  throw new Error(
    `Could not decompress PoB payload: ${lastError instanceof Error ? lastError.message : 'unknown error'}`,
  )
}

/** Decode a Path of Building share code to its XML build document. */
export function decodePoBShareCode(input: string): string {
  const base64 = normalizePoBShareCode(input)
  const compressed = Buffer.from(base64, 'base64')
  if (compressed.length === 0) throw new Error('PoB share code is empty after decoding.')

  const xmlBuffer = decompressPoBPayload(compressed)
  const xml = xmlBuffer.toString('utf-8').replace(/^\uFEFF/, '')
  if (!xml.trimStart().startsWith('<')) {
    throw new Error('Decoded PoB data is not XML. Check that the share code is complete.')
  }
  return xml
}
