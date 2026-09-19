import { defineCommand, type Command, type Ctx } from '../core/registry.js'
import type { ParsedLine } from '../core/tokenizer.js'

/**
 * Text filters. Pipes carry lines of plain text and nothing else, so each of
 * these is a pure function of `string[]` with a thin command around it — which
 * is also what makes them testable without a browser.
 */

export const applyGrep = (lines: string[], pattern: string, invert = false): string[] => {
  const needle = pattern.toLowerCase()
  return lines.filter((l) => l.toLowerCase().includes(needle) !== invert)
}

export const applyHead = (lines: string[], n: number): string[] => lines.slice(0, Math.max(0, n))
export const applyTail = (lines: string[], n: number): string[] =>
  n <= 0 ? [] : lines.slice(-n)

export const applySort = (lines: string[], reverse = false): string[] => {
  const out = [...lines].sort((a, b) => a.localeCompare(b))
  return reverse ? out.reverse() : out
}

/** Collapses runs of equal adjacent lines, the way the real `uniq` does. */
export const applyUniq = (lines: string[]): string[] =>
  lines.filter((l, i) => i === 0 || l !== lines[i - 1])

export function applyWc(lines: string[], opts: { lines?: boolean; words?: boolean; chars?: boolean } = {}): string {
  const text = lines.join('\n')
  const words = (text.match(/\S+/g) || []).length
  const counts = { lines: lines.length, words, chars: text.length }
  const only = opts.lines || opts.words || opts.chars
  if (!only) return `${counts.lines} ${counts.words} ${counts.chars}`
  return [opts.lines && counts.lines, opts.words && counts.words, opts.chars && counts.chars]
    .filter((v) => v !== false && v !== undefined).join(' ')
}

/** `head -n 3` and `head -3` both mean three. */
function countFlag(line: ParsedLine, fallback: number): number {
  const raw = typeof line.flags.n === 'string' ? line.flags.n : line.args.find((a) => /^-?\d+$/.test(a))
  const n = Number(raw)
  return Number.isFinite(n) ? Math.abs(n) : fallback
}

/** Every filter needs something to read; say so rather than printing nothing. */
function input(ctx: Ctx, name: string): string[] | null {
  if (ctx.stdin) return ctx.stdin
  ctx.error(`${name}: reads from a pipe — try \`blog | ${name}\``)
  return null
}

const wc = defineCommand({
  name: 'wc',
  description: 'count lines, words and characters from a pipe',
  usage: 'wc [-l] [-w] [-c]',
  details: 'With no flag, prints all three. `blog | wc -l` counts your posts.',
  run(ctx, line) {
    const lines = input(ctx, 'wc')
    if (!lines) return
    ctx.print(applyWc(lines, { lines: line.flags.l === true, words: line.flags.w === true, chars: line.flags.c === true }))
  },
})

const head = defineCommand({
  name: 'head',
  description: 'keep the first lines from a pipe',
  usage: 'head [-n <count>]',
  valued: ['n'],
  run(ctx, line) {
    const lines = input(ctx, 'head')
    if (!lines) return
    for (const l of applyHead(lines, countFlag(line, 10))) ctx.print(l)
  },
})

const tail = defineCommand({
  name: 'tail',
  description: 'keep the last lines from a pipe',
  usage: 'tail [-n <count>]',
  valued: ['n'],
  run(ctx, line) {
    const lines = input(ctx, 'tail')
    if (!lines) return
    for (const l of applyTail(lines, countFlag(line, 10))) ctx.print(l)
  },
})

const sort = defineCommand({
  name: 'sort',
  description: 'sort lines from a pipe',
  usage: 'sort [-r]',
  run(ctx, line) {
    const lines = input(ctx, 'sort')
    if (!lines) return
    for (const l of applySort(lines, line.flags.r === true)) ctx.print(l)
  },
})

const uniq = defineCommand({
  name: 'uniq',
  description: 'drop repeated adjacent lines from a pipe',
  usage: 'uniq',
  details: 'Like the real one, it only collapses neighbours — `sort | uniq`.',
  run(ctx) {
    const lines = input(ctx, 'uniq')
    if (!lines) return
    for (const l of applyUniq(lines)) ctx.print(l)
  },
})

export const filters: Command[] = [wc, head, tail, sort, uniq]
