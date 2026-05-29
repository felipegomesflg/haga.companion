/** Extract PoB share code from latest user message in agent transcript JSONL. */
import fs from 'node:fs'

const transcriptPath = process.argv[2]
if (!transcriptPath) {
  console.error('Usage: node extract-pob-from-transcript.mjs <path-to.jsonl>')
  process.exit(1)
}

const lines = fs.readFileSync(transcriptPath, 'utf8').trim().split('\n')
for (let i = lines.length - 1; i >= 0; i--) {
  const line = lines[i]
  if (!line.includes('eNrt')) continue
  const parsed = JSON.parse(line)
  const text = parsed.message?.content?.find((c) => c.type === 'text')?.text ?? ''
  const match = text.match(/\n(eNrt[\w+/=-]+)\s*$/s) ?? text.match(/(eNrt[\w+/=-]+)/)
  if (match) {
    process.stdout.write(match[1].replace(/\s/g, ''))
    process.exit(0)
  }
}
console.error('No PoB code found in transcript')
process.exit(1)
