import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { parseLine, parseTokens, tokenize, splitPipeline } from '../src/core/tokenizer.js'
import { expandHistory, expandAliasStages } from '../src/core/expand.js'
import { Terminal } from '../src/core/terminal.js'
import { Registry, defineCommand } from '../src/core/registry.js'

/**
 * Regression tests for an adversarial review. Each one names a defect that was
 * found and fixed; the assertions are the corrected behaviour.
 */

// ---------------------------------------------------------------------------
// 1. VALUED single letters swallow the operand of unrelated commands.

describe('short flags only take a value for the command that claims one', () => {
  it('echo -n keeps its word', () => {
    const p = parseLine('echo -n hello')
    expect(p.flags.n).toBe(true)
    expect(p.args).toEqual(['hello'])
  })

  it('cat -n keeps its filename', () => {
    const p = parseLine('cat -n notes.md')
    expect(p.args).toEqual(['notes.md'])
  })

  it('grep -c keeps its pattern', () => {
    const p = parseLine('grep -c design')
    expect(p.flags.c).toBe(true)
    expect(p.args).toEqual(['design'])
  })

  it('ls -c keeps its path', () => {
    const p = parseLine('ls -c /')
    expect(p.args).toEqual(['/'])
  })

  it('bundling does not consume the next word', () => {
    const p = parseLine('wc -lc 5')
    expect(p.flags.l).toBe(true)
    expect(p.flags.c).toBe(true)
    expect(p.args).toEqual(['5'])
  })

  it('but head, which claims -n, still takes its count', () => {
    const p = parseTokens(tokenize('head -n 3'), '', ['n'])
    expect(p.flags.n).toBe('3')
  })
})

// ---------------------------------------------------------------------------
// 2. head -n0 falls back to 10 instead of 0.

describe('numeric flag shapes', () => {
  it('-n0 is one flag with a value for a command that claims -n', () => {
    const p = parseTokens(tokenize('head -n0'), '', ['n'])
    expect(p.flags.n).toBe('0')
  })

  it('and stays two boolean letters for a command that does not', () => {
    const p = parseLine('echo -n0')
    expect(p.flags.n).toBe(true)
    expect(p.flags['0']).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 3. History expansion ignores single quotes, and aborts the whole line.

describe('history expansion quoting', () => {
  it('leaves a ! inside single quotes alone, rather than abandoning the line', () => {
    const r = expandHistory("echo 'hello !world'", ['ls'])
    expect(r.missing).toBeUndefined()
    expect(r.line).toBe("echo 'hello !world'")
  })

  it('does not rewrite a quoted ! that would have matched', () => {
    expect(expandHistory("echo 'hi !ls'", ['ls posts']).line).toBe("echo 'hi !ls'")
    expect(expandHistory("echo '!ls'", ['ls posts']).line).toBe("echo '!ls'")
  })

  it('still expands outside quotes', () => {
    expect(expandHistory('!!', ['theme nord']).line).toBe('theme nord')
    expect(expandHistory('echo "hi !!"', ['ls']).line).toBe('echo "hi ls"')
  })
})

// ---------------------------------------------------------------------------
// 4. Alias lookup walks Object.prototype.

describe('alias lookup and the prototype chain', () => {
  it('leaves `constructor` alone', () => {
    const aliases = JSON.parse('{}') as Record<string, string>
    expect(expandAliasStages([['constructor']], aliases)).toEqual([['constructor']])
  })

  it('leaves hasOwnProperty alone', () => {
    expect(expandAliasStages([['hasOwnProperty', 'x']], {})).toEqual([['hasOwnProperty', 'x']])
  })

  it('still expands a real alias', () => {
    expect(expandAliasStages([['ll']], { ll: 'ls -l' })).toEqual([['ls', '-l']])
  })
})

// ---------------------------------------------------------------------------
// 5. Every stage of a pipeline is handed the whole line as `raw`.

describe('stage raw', () => {
  it('is the full line, not the stage', () => {
    const line = "alias ll='ls -l' | wc -l"
    const stages = splitPipeline(line).map((t) => parseTokens(t, line))
    expect(stages[1].raw).toBe(line) // the `wc` stage claims the alias text is its own
    expect(stages[0].raw).toBe(line)
  })
})

// ---------------------------------------------------------------------------
// 6. Terminal: Tab completion is not pipeline-aware when it edits the line.

const mkRegistry = () => new Registry()
  .add(defineCommand({ name: 'help', description: 'help', run: () => {} }))
  .add(defineCommand({ name: 'wc', description: 'wc', run: () => {} }))
  .add(defineCommand({ name: 'cat', description: 'cat', run: () => {} }))
  .add(defineCommand({ name: 'cd', description: 'cd', run: () => {} }))
  .add(defineCommand({ name: 'clear', description: 'clear', run: () => {} }))
  .add(defineCommand({ name: 'theme', description: 'theme', run: () => {} }))

const mount = (history: string[] = []) => {
  document.body.innerHTML = ''
  localStorage.setItem('proseos:history', JSON.stringify(history))
  const host = document.createElement('div')
  document.body.appendChild(host)
  const term = new Terminal({
    root: host,
    registry: mkRegistry(),
    prompt: () => '$',
    onLine: async () => {},
  })
  return term
}

const key = (term: Terminal, k: string, init: KeyboardEventInit = {}) => {
  term.input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }))
}

describe('Tab completion after a pipe', () => {
  beforeEach(() => { localStorage.removeItem('proseos:history') })

  it('keeps every earlier stage when a single match completes', () => {
    const term = mount()
    term.setValue('wc|hel')
    key(term, 'Tab')
    expect(term.input.value).toBe('wc|help ')
  })

  it('keeps them while cycling a listing too', () => {
    const term = mount()
    term.setValue('wc|c')
    key(term, 'Tab') // lists cat/cd/clear
    expect(term.input.value).toBe('wc|c')
    key(term, 'Tab') // cycles onto the first match
    expect(term.input.value).toBe('wc|cat')
  })

  it('is correct when a space follows the bar', () => {
    const term = mount()
    term.setValue('wc | hel')
    key(term, 'Tab')
    expect(term.input.value).toBe('wc | help ')
  })
})

describe('completion state survives edits that are not typing', () => {
  it('↑ drops a pending completion cycle', () => {
    const term = mount(['theme gruvbox'])
    term.setValue('c')
    key(term, 'Tab') // multiple matches: cat, cd, clear -> listing, state kept
    expect(term.input.value).toBe('c')
    key(term, 'ArrowUp') // recall history; the stale cycle must be dropped
    expect(term.input.value).toBe('theme gruvbox')
    key(term, 'Tab')
    expect(term.input.value).toBe('theme gruvbox')
  })

  it('Enter drops it too', async () => {
    const term = mount()
    term.setValue('c')
    key(term, 'Tab')
    key(term, 'Enter') // submit; input is cleared
    await Promise.resolve()
    expect(term.input.value).toBe('')
    key(term, 'Tab')
    // A fresh listing of every command, not an insertion from the old cycle.
    expect(term.input.value).toBe('')
  })
})

// ---------------------------------------------------------------------------
// 7. Ctrl+R hands its found line to ↑ as the draft.

describe('reverse search and the draft', () => {
  it('a key that leaves the search makes the match the history draft', () => {
    const term = mount(['ls posts', 'theme list'])
    term.setValue('half typed')
    key(term, 'r', { ctrlKey: true })
    key(term, 'l') // query 'l' -> matches 'theme list'
    expect(term.input.value).toBe('theme list')
    key(term, 'ArrowUp') // leaves the search, then steps history
    expect(term.input.value).toBe('theme list')
    key(term, 'ArrowDown') // back to the bottom: the draft
    // Expected: 'half typed'
    expect(term.input.value).toBe('theme list')
  })
})

// ---------------------------------------------------------------------------
// 8. tokenize vs splitPipeline on the same text.

describe('tokenize and splitPipeline agree on quoting', () => {
  it('escaped bar', () => {
    expect(tokenize('echo a\\|b')).toEqual(['echo', 'a|b'])
    expect(splitPipeline('echo a\\|b')).toEqual([['echo', 'a|b']])
  })

  it('unterminated quote swallows the bar in both', () => {
    expect(tokenize('echo "a | b')).toEqual(['echo', 'a | b'])
    expect(splitPipeline('echo "a | b')).toEqual([['echo', 'a | b']])
  })

  it('splitPipeline always emits a final stage, tokenize does not', () => {
    expect(splitPipeline('')).toEqual([[]])
    expect(tokenize('')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 9. themes[] is an object literal, so the theme command's guard is bypassable.

describe('theme name lookup ignores the prototype chain', () => {
  it('falls back instead of throwing on an inherited key', async () => {
    const { themes, apply } = await import('../src/core/theme.js')
    // The hazard is still there in the shape of the data...
    expect(themes['constructor']).toBeTruthy()
    // ...but the lookup no longer walks into it.
    expect(() => apply('constructor')).not.toThrow()
    expect(apply('constructor').name).toBe('anthropic')
    expect(document.documentElement.style.getPropertyValue('--bg')).not.toBe('undefined')
    apply('anthropic')
  })
})

// ---------------------------------------------------------------------------
// 10. Running a line while Ctrl+R is active leaves the search mode on.

describe('reverse search does not outlive a command from elsewhere', () => {
  const promptText = (t: Terminal) => t.root.querySelector('.term-prompt')!.textContent

  it('ends the search when a tapped token runs', async () => {
    const term = mount(['ls posts', 'theme list'])
    key(term, 'r', { ctrlKey: true })
    key(term, 'l')
    expect(promptText(term)).toBe("(reverse-i-search)'l':")
    // Exactly what the document [data-cmd] click handler does:
    await term.run('help')
    expect(promptText(term)).not.toContain('reverse-i-search')
    const ev = new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true })
    term.input.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false) // typing reaches the line again
  })
})

// ---------------------------------------------------------------------------
// 11. `!` expansion positions, and the empty-string path for `cd`.

describe('history expansion positions', () => {
  it('does not expand after a bar', () => {
    const r = expandHistory('ls|!!', ['ls posts'])
    expect(r.changed).toBe(false)
    expect(r.line).toBe('ls|!!') // runs as the command `!!` -> command not found
  })

  it('does expand after a space following a bar', () => {
    expect(expandHistory('ls| !!', ['wc -l']).line).toBe('ls| wc -l')
  })
})

describe('cd with an empty argument', () => {
  it('keeps the empty string, so `?? "/"` does not fire', () => {
    expect(parseLine('cd ""').args).toEqual([''])
    // builtin.ts:139 passes '' to ctx.chdir, whose own `path || "~"` then means
    // `cd ""` goes home while a bare `cd` goes to `/`.
  })
})

afterAll(() => {
  try { localStorage.removeItem('proseos:history') } catch { /* ignore */ }
})
