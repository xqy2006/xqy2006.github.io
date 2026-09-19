/**
 * Line rewriting that happens before anything is tokenized: history
 * expansion and aliases, in that order, exactly as a shell does it.
 *
 * Both are pure functions of the line so they can be tested without a
 * terminal, and both are applied once — an alias that names itself is a loop
 * nobody wants to debug in a blog.
 */

import { splitPipeline } from './tokenizer.js'

export interface Aliases { [name: string]: string }

/**
 * `!!` repeats the last command, `!7` repeats that numbered one from
 * `history`, and `!gr` repeats the most recent starting with `gr`.
 *
 * Returns the line unchanged when nothing matches, and reports what it could
 * not find so the caller can complain the way bash does.
 */
export function expandHistory(
  line: string,
  history: readonly string[],
): { line: string; changed: boolean; missing?: string } {
  if (!line.includes('!')) return { line, changed: false }

  const lookup = (ref: string): string | undefined => {
    if (ref === '!') return history[history.length - 1]
    if (/^\d+$/.test(ref)) return history[Number(ref) - 1]
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].startsWith(ref)) return history[i]
    }
    return undefined
  }

  let out = ''
  let changed = false
  let missing: string | undefined
  let quoted = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    // Single quotes suppress expansion, so `echo '!'` is printable. Double
    // quotes do not, which is also what bash does.
    if (quoted) {
      out += ch
      if (ch === "'") quoted = false
      continue
    }
    if (ch === "'") { quoted = true; out += ch; continue }
    if (ch === '!' && (i === 0 || /\s/.test(line[i - 1]))) {
      const m = /^!(!|\d+|[A-Za-z][\w-]*)/.exec(line.slice(i))
      if (m) {
        const found = lookup(m[1])
        if (found === undefined) { missing ??= `!${m[1]}` } else { changed = true }
        out += found ?? m[0]
        i += m[0].length - 1
        continue
      }
    }
    out += ch
  }

  return { line: out, changed, missing }
}

/**
 * Replace a stage's command with what its alias stands for.
 *
 * This works on the token stages the pipeline splitter already produced
 * rather than on the raw text, which is what keeps `echo "a | ll"` from
 * having its quoted argument rewritten. An alias may itself contain pipes, in
 * which case it becomes several stages and the original arguments follow the
 * last of them. Expansion is not recursive: an alias naming itself stops.
 */
export function expandAliasStages(stages: string[][], aliases: Aliases): string[][] {
  const out: string[][] = []
  for (const tokens of stages) {
    const [name, ...rest] = tokens
    const value = name !== undefined && Object.hasOwn(aliases, name) ? aliases[name] : undefined
    if (value === undefined) { out.push(tokens); continue }
    const sub = splitPipeline(value)
    if (!sub.length || !sub[sub.length - 1].length) { out.push(tokens); continue }
    sub[sub.length - 1] = [...sub[sub.length - 1], ...rest]
    out.push(...sub)
  }
  return out
}

/** `alias ll='ls -l'` and `alias ll=ls -l` both parse. */
export function parseAliasArg(raw: string): { name: string; value: string } | null {
  const eq = raw.indexOf('=')
  if (eq <= 0) return null
  const name = raw.slice(0, eq).trim()
  let value = raw.slice(eq + 1).trim()
  if (value.length >= 2 && (value[0] === "'" || value[0] === '"') && value[value.length - 1] === value[0]) {
    value = value.slice(1, -1)
  }
  if (!/^[A-Za-z_][\w.-]*$/.test(name) || !value) return null
  return { name, value }
}
