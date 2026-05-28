import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EN = path.join(__dirname, 'campaign-pt-descriptions-en-export.json')
const OUT = path.join(__dirname, 'campaign-pt-descriptions-generated.json')

const PHRASES = [
  ['Optional but highly recommended', 'Opcional, mas altamente recomendado'],
  ['Optional power spike', 'Spike de poder opcional'],
  ['Strongly recommended', 'Fortemente recomendado'],
  ['always worth killing', 'sempre vale a pena matar'],
  ['Step-by-step', 'Passo a passo'],
  ['Route tip', 'Dica de rota'],
  ['Return to', 'Volte para'],
  ['Proceed to', 'Avance para'],
  ['Enter ', 'Entre em '],
  ['Travel to', 'Vá para'],
  ['Defeat ', 'Derrote '],
  ['Speak with', 'Fale com'],
  ['Speak to', 'Fale com'],
  ['Complete ', 'Complete '],
  ['Optional:', 'Opcional:'],
  ['Optional ', 'Opcional '],
  ['Permanent rewards', 'Recompensas permanentes'],
  ['Permanent reward', 'Recompensa permanente'],
  ['Permanent buff', 'Buff permanente'],
  ['permanent', 'permanente'],
  ['Recommended FIRST', 'Recomendado PRIMEIRO'],
  ['Recommended SECOND', 'Recomendado SEGUNDO'],
  ['Recommended LAST', 'Recomendado POR ÚLTIMO'],
  ['Act Boss', 'Chefe do Ato'],
  ['act boss', 'chefe do ato'],
  ['act finale', 'final do ato'],
  ['Coming soon', 'Em breve'],
  ['No objectives', 'Nenhum objetivo'],
  ['In this zone', 'Nesta zona'],
  ['Main quest', 'Missão principal'],
  ['Crafting bench', 'Bancada de crafting'],
  ['Gear & gems', 'Equipamento e gemas'],
  ['Currency & vendor', 'Moeda e vendedor'],
  ['Passive Points', 'Pontos Passivos'],
  ['passive skill points', 'pontos passivos de skill'],
  ['passive points', 'pontos passivos'],
  ['maximum Spirit', 'espírito máximo'],
  ['maximum life', 'vida máxima'],
  ['Skill Gem', 'Gema de Skill'],
  ['Support Gem', 'Gema de Suporte'],
  ['Uncut Skill Gem', 'Gema de Skill Não Lapidada'],
  ['Uncut Support Gem', 'Gema de Suporte Não Lapidada'],
  ['league start', 'início de liga'],
  ['speed runs', 'speedruns'],
  ['before pushing', 'antes de avançar'],
  ['after the fight', 'após a luta'],
  ['after collecting', 'após coletar'],
  ['after activating', 'após ativar'],
  ['after the act boss', 'após o chefe do ato'],
  ['first hub', 'primeiro hub'],
  ['pick up', 'pegue'],
  ['search for', 'procure'],
  ['find the', 'encontre o'],
  ['locate the', 'localize o'],
  ['unlock the', 'desbloqueie o'],
  ['unlock ', 'desbloqueie '],
  ['deliver ', 'entregue '],
  ['reporting back grants', 'reportar de volta concede'],
  ['grants:', 'concede:'],
  ['grants ', 'concede '],
  ['This is', 'Este é'],
  ['This establishes', 'Isto estabelece'],
  ['You will return here', 'Você voltará aqui'],
  ['Check-in', 'Check-in'],
]

function mechanicalPt(text) {
  let out = text
  for (const [from, to] of PHRASES) {
    out = out.split(from).join(to)
  }
  return out
}

const en = JSON.parse(fs.readFileSync(EN, 'utf8'))
const pt = {}
for (const [id, description] of Object.entries(en)) {
  pt[id] = mechanicalPt(description)
}

fs.writeFileSync(OUT, JSON.stringify(pt, null, 2), 'utf-8')
console.log(`Wrote ${Object.keys(pt).length} mechanical PT descriptions to ${OUT}`)
