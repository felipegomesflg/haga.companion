import { protocol, net } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { getAppDataDir } from '../db/paths'

export function registerLocalAssetProtocol(): void {
  protocol.handle('haga-local', async (request) => {
    const url = new URL(request.url)
    const relativePath = decodeURIComponent(url.pathname.replace(/^\//, ''))
    const base = path.resolve(getAppDataDir())
    const filePath = path.resolve(base, relativePath)

    if (filePath !== base && !filePath.startsWith(base + path.sep)) {
      return new Response('Forbidden', { status: 403 })
    }

    return net.fetch(pathToFileURL(filePath).href)
  })
}

export function toLocalAssetUrl(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/')
  return `haga-local://${encodeURI(normalized)}`
}
