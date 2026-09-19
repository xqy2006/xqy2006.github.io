export interface ParsedLine {
  /** The command name, lowercased. Empty for a blank line. */
  name: string
  /** Positional arguments, quotes removed. */
  args: string[]
  /** `--long=v`, `--long v`, `--long`, and bundled `-abc`. */
  flags: Record<string, string | true>
  raw: string
}

/**
 * Split a line into pipeline stages, each a token list.
 *
 * The split happens during tokenizing rather than with a regex beforehand, so
 * quoting protects the bar: `echo "a | b"` is one argument, `ls|wc` is two
 * stages, and `echo a\\|b` is a literal.
 */
export function splitPipeline(line: string): string[][] {
  const stages: string[][] = []
  let stage: string[] = []
  let cur = ''
  let quote: '"' | "'" | null = null
  let started = false

  const endToken = () => { if (started) { stage.push(cur); cur = ''; started = false } }
  const endStage = () => { endToken(); stages.push(stage); stage = [] }

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '\\' && i + 1 < line.length && quote !== "'") {
      cur += line[++i]
      started = true
      continue
    }
    if (quote) {
      if (ch === quote) quote = null
      else cur += ch
      continue
    }
    if (ch === '"' || ch === "'") { quote = ch; started = true; continue }
    if (ch === '|') { endStage(); continue }
    if (/\s/.test(ch)) { endToken(); continue }
    cur += ch
    started = true
  }
  endStage()
  return stages
}

/** Split on whitespace, honouring single and double quotes and backslash escapes. */
export function tokenize(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote: '"' | "'" | null = null
  let started = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '\\' && i + 1 < line.length && quote !== "'") {
      cur += line[++i]
      started = true
      continue
    }
    if (quote) {
      if (ch === quote) quote = null
      else cur += ch
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      started = true
      continue
    }
    if (/\s/.test(ch)) {
      if (started) { out.push(cur); cur = ''; started = false }
      continue
    }
    cur += ch
    started = true
  }
  if (started) out.push(cur)
  return out
}

/** Flags that take a following value rather than standing alone. */
/**
 * Long flags that take the next token as their value, for every command.
 *
 * Single letters are deliberately NOT here: `-n` means a count to `head` and
 * a suppressed newline to `echo`, so a global list would make one of them
 * swallow the other's operand. Commands declare their own with `valued`.
 */
const VALUED = new Set(['colors', 'tag', 'columns'])

export function parseLine(line: string): ParsedLine {
  return parseTokens(tokenize(line.trim()), line)
}

/**
 * Every stage of a pipeline, parsed. A stage with no name is a syntax error.
 *
 * `valuedFor` supplies each command's own value-taking short flags; without it
 * every short flag is a boolean.
 */
export function parsePipeline(
  line: string,
  valuedFor: (name: string) => readonly string[] | undefined = () => undefined,
): ParsedLine[] {
  return splitPipeline(line).map((tokens) => parseTokens(tokens, line, valuedFor(tokens[0] ?? '') ?? []))
}

export function parseTokens(tokens: string[], raw = '', valued: readonly string[] = []): ParsedLine {
  const takesValue = (flag: string) => VALUED.has(flag) || valued.includes(flag)
  const parts = tokens.slice()
  const flags: Record<string, string | true> = {}
  const args: string[] = []
  const name = (parts.shift() || '').toLowerCase()

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (p.startsWith('--')) {
      const body = p.slice(2)
      const eq = body.indexOf('=')
      if (eq !== -1) {
        flags[body.slice(0, eq)] = body.slice(eq + 1)
      } else if (takesValue(body) && i + 1 < parts.length && !parts[i + 1].startsWith('-')) {
        flags[body] = parts[++i]
      } else {
        flags[body] = true
      }
    } else if (/^-[A-Za-z]\d+$/.test(p) && takesValue(p[1])) {
      // `-n3` is one flag with a value, not the letters n and 3.
      flags[p[1]] = p.slice(2)
    } else if (p.startsWith('-') && p.length > 1 && !/^-\d/.test(p)) {
      const letters = p.slice(1).split('')
      const last = letters[letters.length - 1]
      for (const l of letters) flags[l] = true
      if (takesValue(last) && i + 1 < parts.length && !parts[i + 1].startsWith('-')) {
        flags[last] = parts[++i]
      }
    } else {
      args.push(p)
    }
  }

  return { name, args, flags, raw }
}
