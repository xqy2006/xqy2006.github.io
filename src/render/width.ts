import stringWidth from 'string-width'

/**
 * Display width, in terminal cells. A CJK ideograph is 2, an emoji is 2,
 * a combining mark is 0. Never use String#length for layout: the Chinese
 * sample post breaks every box and column if you do.
 */
export const width = (s: string): number => stringWidth(s)

/** Strip tags so width is measured on what the reader sees, not the markup. */
export const plain = (html: string): string =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

export const padEnd = (s: string, w: number, fill = ' '): string =>
  s + fill.repeat(Math.max(0, w - width(s)))

export const padStart = (s: string, w: number, fill = ' '): string =>
  fill.repeat(Math.max(0, w - width(s))) + s

export const center = (s: string, w: number, fill = ' '): string => {
  const slack = Math.max(0, w - width(s))
  const left = Math.floor(slack / 2)
  return fill.repeat(left) + s + fill.repeat(slack - left)
}

/** Truncate to `w` cells, accounting for wide glyphs, with an ellipsis. */
export function truncate(s: string, w: number, ellipsis = '…'): string {
  if (width(s) <= w) return s
  const budget = w - width(ellipsis)
  let out = ''
  for (const ch of s) {
    if (width(out + ch) > budget) break
    out += ch
  }
  return out + ellipsis
}

/** Lay out items in newspaper columns the way `ls` does. */
export function columnize(items: string[], totalWidth: number, gap = 2): string[] {
  if (!items.length) return []
  const cell = Math.max(...items.map(width)) + gap
  const cols = Math.max(1, Math.floor(totalWidth / cell))
  const rows = Math.ceil(items.length / cols)
  const lines: string[] = []
  for (let r = 0; r < rows; r++) {
    let line = ''
    for (let c = 0; c < cols; c++) {
      const item = items[c * rows + r]
      if (item === undefined) continue
      line += c === cols - 1 ? item : padEnd(item, cell)
    }
    lines.push(line.replace(/\s+$/, ''))
  }
  return lines
}

export const BOX = {
  tl: '┌', tr: '┐', bl: '└', br: '┘',
  h: '─', v: '│',
  teeDown: '┬', teeUp: '┴', teeRight: '├', teeLeft: '┤', cross: '┼',
} as const
