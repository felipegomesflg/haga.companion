/** PoE gem color codes from RePoE skill_gems.json */
export type GemColorCode = 'r' | 'g' | 'b' | 'w'

export function gemColorTextClass(color: string | null | undefined): string {
  switch (color) {
    case 'r':
      return 'gem-color--r'
    case 'g':
      return 'gem-color--g'
    case 'b':
      return 'gem-color--b'
    case 'w':
      return 'gem-color--w'
    default:
      return 'gem-color--default'
  }
}

export function gemColorBorderClass(color: string | null | undefined): string {
  switch (color) {
    case 'r':
      return 'gem-border--r'
    case 'g':
      return 'gem-border--g'
    case 'b':
      return 'gem-border--b'
    case 'w':
      return 'gem-border--w'
    default:
      return 'gem-border--default'
  }
}
