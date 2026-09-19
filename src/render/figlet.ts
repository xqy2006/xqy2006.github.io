import { BOX, width, padEnd } from './width.js'

/**
 * A five-row block font, wide enough to read as a masthead and narrow enough
 * that a seven-letter name fits a desktop terminal. Every glyph is five cells
 * wide, so the banner width is a plain function of the character count.
 *
 * The header is generated from `site.title` rather than pasted in, so renaming
 * the site redraws it.
 */
const GLYPH_W = 5

const FONT: Record<string, string[]> = {
  A: [' ███ ', '█   █', '█████', '█   █', '█   █'],
  B: ['████ ', '█   █', '████ ', '█   █', '████ '],
  C: [' ████', '█    ', '█    ', '█    ', ' ████'],
  D: ['████ ', '█   █', '█   █', '█   █', '████ '],
  E: ['█████', '█    ', '████ ', '█    ', '█████'],
  F: ['█████', '█    ', '████ ', '█    ', '█    '],
  G: [' ████', '█    ', '█  ██', '█   █', ' ████'],
  H: ['█   █', '█   █', '█████', '█   █', '█   █'],
  I: ['█████', '  █  ', '  █  ', '  █  ', '█████'],
  J: ['█████', '   █ ', '   █ ', '█  █ ', ' ██  '],
  K: ['█   █', '█  █ ', '███  ', '█  █ ', '█   █'],
  L: ['█    ', '█    ', '█    ', '█    ', '█████'],
  M: ['█   █', '██ ██', '█ █ █', '█   █', '█   █'],
  N: ['█   █', '██  █', '█ █ █', '█  ██', '█   █'],
  O: [' ███ ', '█   █', '█   █', '█   █', ' ███ '],
  P: ['████ ', '█   █', '████ ', '█    ', '█    '],
  Q: [' ███ ', '█   █', '█ █ █', '█  █ ', ' ██ █'],
  R: ['████ ', '█   █', '████ ', '█  █ ', '█   █'],
  S: [' ████', '█    ', ' ███ ', '    █', '████ '],
  T: ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
  U: ['█   █', '█   █', '█   █', '█   █', ' ███ '],
  V: ['█   █', '█   █', '█   █', ' █ █ ', '  █  '],
  W: ['█   █', '█   █', '█ █ █', '██ ██', '█   █'],
  X: ['█   █', ' █ █ ', '  █  ', ' █ █ ', '█   █'],
  Y: ['█   █', ' █ █ ', '  █  ', '  █  ', '  █  '],
  Z: ['█████', '   █ ', '  █  ', ' █   ', '█████'],
  '0': [' ███ ', '█  ██', '█ █ █', '██  █', ' ███ '],
  '1': ['  █  ', ' ██  ', '  █  ', '  █  ', '█████'],
  '2': [' ███ ', '█   █', '   █ ', '  █  ', '█████'],
  '3': ['████ ', '    █', ' ███ ', '    █', '████ '],
  '4': ['█   █', '█   █', '█████', '    █', '    █'],
  '5': ['█████', '█    ', '████ ', '    █', '████ '],
  '6': [' ████', '█    ', '████ ', '█   █', ' ███ '],
  '7': ['█████', '   █ ', '  █  ', ' █   ', '█    '],
  '8': [' ███ ', '█   █', ' ███ ', '█   █', ' ███ '],
  '9': [' ███ ', '█   █', ' ████', '    █', '████ '],
  '-': ['     ', '     ', '█████', '     ', '     '],
  '.': ['     ', '     ', '     ', '     ', '  █  '],
  '_': ['     ', '     ', '     ', '     ', '█████'],
  ' ': ['     ', '     ', '     ', '     ', '     '],
  // Marks a title is likely to contain. Without them a possessive title came
  // out as "XQY2006 S BLOG": an unknown character renders as a blank, which
  // is quiet enough to look deliberate.
  "'": ['  █  ', '  █  ', '     ', '     ', '     '],
  '"': [' █ █ ', ' █ █ ', '     ', '     ', '     '],
  '!': ['  █  ', '  █  ', '  █  ', '     ', '  █  '],
  '?': [' ███ ', '█   █', '  ██ ', '     ', '  █  '],
  ',': ['     ', '     ', '     ', '  █  ', ' █   '],
  ':': ['     ', '  █  ', '     ', '  █  ', '     '],
  ';': ['     ', '  █  ', '     ', '  █  ', ' █   '],
  '&': [' ██  ', '█  █ ', ' ██  ', '█  █ ', ' ██ █'],
  '+': ['     ', '  █  ', ' ███ ', '  █  ', '     '],
  '=': ['     ', '█████', '     ', '█████', '     '],
  '*': ['     ', '█ █ █', ' ███ ', '█ █ █', '     '],
  '#': [' █ █ ', '█████', ' █ █ ', '█████', ' █ █ '],
  '/': ['    █', '   █ ', '  █  ', ' █   ', '█    '],
  '(': ['   █ ', '  █  ', '  █  ', '  █  ', '   █ '],
  ')': [' █   ', '  █  ', '  █  ', '  █  ', ' █   '],
}

/**
 * Typographic quotes stand in for the marks above them.
 *
 * A title written in a word processor, or by anyone whose keyboard is helpful,
 * carries curly quotes. They are the same letter as far as block capitals are
 * concerned.
 */
const ALIAS: Record<string, string> = {
  '\u2018': "'", '\u2019': "'", '\u02bc': "'",
  '\u201c': '"', '\u201d': '"',
  '\u2013': '-', '\u2014': '-', '\u2212': '-',
}

const fold = (c: string): string => ALIAS[c] ?? c

const BLANK = FONT[' ']

/** The font covers Latin letters, digits and a few marks — nothing else. */
export const unsupported = (text: string): string[] =>
  [...new Set([...text.toUpperCase()])].filter((c) => !(fold(c) in FONT))

/** Width in cells the banner would occupy, without rendering it. */
export const bannerWidth = (text: string): number => {
  // Measure what will actually be drawn: renderBanner uppercases first, and
  // that can lengthen a string — 'Straße' becomes six letters wide, not five.
  const n = [...text.toUpperCase()].length
  return n ? n * GLYPH_W + (n - 1) : 0
}

/** Five rows of block letters. Unsupported characters render as blanks. */
export function renderBanner(text: string): string[] {
  const glyphs = [...text.toUpperCase()].map((c) => FONT[fold(c)] ?? BLANK)
  if (!glyphs.length) return []
  return Array.from({ length: 5 }, (_, row) => glyphs.map((g) => g[row]).join(' '))
}

export interface BoxOptions {
  /** Cells of padding either side of the content. */
  padX?: number
  /** Right-aligned text tucked into the bottom rule, like a terminal title. */
  footer?: string
}

/** Frame lines in box-drawing characters, padded by display width. */
export function boxed(lines: string[], opts: BoxOptions = {}): string[] {
  const padX = opts.padX ?? 2
  const inner = Math.max(0, ...lines.map(width))
  const span = inner + padX * 2
  const pad = ' '.repeat(padX)

  const top = BOX.tl + BOX.h.repeat(span) + BOX.tr
  let bottom = BOX.bl + BOX.h.repeat(span) + BOX.br
  if (opts.footer) {
    const label = ` ${opts.footer} `
    const room = span - width(label) - 1
    if (room >= 0) {
      bottom = BOX.bl + BOX.h.repeat(room) + label + BOX.h + BOX.br
    }
  }
  return [
    top,
    ...lines.map((l) => BOX.v + pad + padEnd(l, inner) + pad + BOX.v),
    bottom,
  ]
}
