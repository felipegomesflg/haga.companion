import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { gzipSync, gunzipSync } from 'node:zlib'
import { exportBuildPayload, importBuildPayload } from './buildService'
import type { BuildProfile } from '../../src/types/build'

const SECRET = 'haga-overlay-felgom-ltda-v1'
const KEY = createHash('sha256').update(SECRET).digest()

export function exportShareCode(buildId: string): string {
  const payload = exportBuildPayload(buildId)
  const compressed = gzipSync(Buffer.from(JSON.stringify(payload), 'utf-8'))
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final(), cipher.getAuthTag()])
  const combined = Buffer.concat([iv, encrypted])
  return `HAGA-${combined.toString('base64url')}`
}

export function importShareCode(code: string): BuildProfile {
  const raw = code.trim().replace(/^HAGA-/i, '')
  const combined = Buffer.from(raw, 'base64url')
  const iv = combined.subarray(0, 12)
  const authTag = combined.subarray(combined.length - 16)
  const data = combined.subarray(12, combined.length - 16)

  const decipher = createDecipheriv('aes-256-gcm', KEY, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  const json = JSON.parse(gunzipSync(decrypted).toString('utf-8'))
  return importBuildPayload(json)
}
