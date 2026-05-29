/**
 * Decode a Path of Building share code to XML.
 * Usage: node scripts/decode-pob-share.mjs <input-file> [output-file]
 *        node scripts/decode-pob-share.mjs --stdin [output-file]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, inflateRawSync, inflateSync } from 'node:zlib'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function normalizePoBShareCode(input) {
  let code = input.trim()
  if (!code) throw new Error('Empty share code')

  const urlMatch = code.match(/[?&]code=([^&]+)/i)
  if (urlMatch) code = urlMatch[1]

  code = code.replace(/\s/g, '')
  code = code.replace(/-/g, '+').replace(/_/g, '/')
  const pad = code.length % 4
  if (pad) code += '='.repeat(4 - pad)
  return code
}

function decompressPoBPayload(buffer) {
  const attempts = [() => inflateSync(buffer), () => gunzipSync(buffer), () => inflateRawSync(buffer)]
  let lastError
  for (const attempt of attempts) {
    try {
      return attempt()
    } catch (err) {
      lastError = err
    }
  }
  throw new Error(
    `Could not decompress: ${lastError instanceof Error ? lastError.message : 'unknown'}`,
  )
}

function decodePoBShareCode(input) {
  const base64 = normalizePoBShareCode(input)
  const compressed = Buffer.from(base64, 'base64')
  const xmlBuffer = decompressPoBPayload(compressed)
  const xml = xmlBuffer.toString('utf-8').replace(/^\uFEFF/, '')
  if (!xml.trimStart().startsWith('<')) {
    throw new Error('Decoded data is not XML')
  }
  return xml
}

function summarize(xml) {
  const build = xml.match(/<Build[^>]*\bclassName="([^"]*)"/)?.[1]
    ?? xml.match(/<Build[^>]*\btargetVersion="([^"]*)"/)?.[1]
  const level = xml.match(/<Build[^>]*\blevel="(\d+)"/)?.[1]
  const tree = xml.match(/<Build[^>]*\btreeVersion="([^"]*)"/)?.[1]
  const title = xml.match(/<Build[^>]*\btitle="([^"]*)"/)?.[1]
  const items = (xml.match(/<Item id="/g) ?? []).length
  const skills = (xml.match(/<SkillSet /g) ?? []).length
  return { title, build, level, tree, items, skills }
}

const useStdin = process.argv[2] === '--stdin'
const inputPath = useStdin ? null : process.argv[2]
const defaultOut = path.join(root, 'data', 'runtime', 'pob-decoded.xml')
const outputPath = process.argv[useStdin ? 3 : 3] ?? defaultOut

const raw = useStdin
  ? fs.readFileSync(0, 'utf8')
  : fs.readFileSync(path.resolve(inputPath), 'utf8')

const xml = decodePoBShareCode(raw)
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, xml, 'utf8')

const info = summarize(xml)
console.log('Decoded OK:', outputPath)
console.log('Size:', xml.length, 'chars')
console.log('Summary:', JSON.stringify(info, null, 2))
