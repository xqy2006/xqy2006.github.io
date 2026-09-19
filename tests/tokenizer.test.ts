import { describe, it, expect } from 'vitest'
import { tokenize, parseLine, parseTokens, splitPipeline, parsePipeline } from '../src/core/tokenizer.js'

describe('tokenizer', () => {
  it('splits on whitespace', () => {
    expect(tokenize('ls posts')).toEqual(['ls', 'posts'])
  })

  it('honours quotes', () => {
    expect(tokenize('find "two words"')).toEqual(['find', 'two words'])
    expect(tokenize("echo 'a b' c")).toEqual(['echo', 'a b', 'c'])
  })

  it('keeps an empty quoted argument', () => {
    expect(tokenize('echo ""')).toEqual(['echo', ''])
  })

  it('handles escapes outside single quotes', () => {
    expect(tokenize('echo a\\ b')).toEqual(['echo', 'a b'])
    expect(tokenize("echo 'a\\ b'")).toEqual(['echo', 'a\\ b'])
  })

  it('handles CJK arguments', () => {
    expect(tokenize('find 中文 排版')).toEqual(['find', '中文', '排版'])
  })
})

describe('parseLine', () => {
  it('lowercases the command but not the arguments', () => {
    const p = parseLine('LS Posts')
    expect(p.name).toBe('ls')
    expect(p.args).toEqual(['Posts'])
  })

  it('parses --flag=value', () => {
    expect(parseLine('render --colors=256').flags).toEqual({ colors: '256' })
  })

  it('parses --flag value for known valued flags', () => {
    expect(parseLine('ls --tag design').flags).toEqual({ tag: 'design' })
    expect(parseLine('ls --tag design').args).toEqual([])
  })

  it('treats unknown long flags as booleans', () => {
    const p = parseLine('render --real')
    expect(p.flags).toEqual({ real: true })
  })

  it('bundles short flags', () => {
    expect(parseLine('ls -la').flags).toEqual({ l: true, a: true })
  })

  it('does not eat a value for an unknown long flag', () => {
    const p = parseLine('open --real slug')
    expect(p.args).toEqual(['slug'])
  })

  it('returns an empty name for a blank line', () => {
    expect(parseLine('   ').name).toBe('')
  })

  it('keeps negative numbers as arguments', () => {
    expect(parseLine('echo -1').args).toEqual(['-1'])
  })
})

describe('pipelines', () => {
  it('splits on a bare bar', () => {
    const s = splitPipeline('ls | grep x')
    expect(s).toEqual([['ls'], ['grep', 'x']])
  })

  it('does not need whitespace around the bar', () => {
    expect(splitPipeline('ls|wc')).toEqual([['ls'], ['wc']])
  })

  it('lets quotes protect a bar', () => {
    expect(splitPipeline('echo "a | b"')).toEqual([['echo', 'a | b']])
    expect(splitPipeline("echo 'a | b'")).toEqual([['echo', 'a | b']])
  })

  it('lets a backslash protect a bar', () => {
    expect(splitPipeline('echo a\\|b')).toEqual([['echo', 'a|b']])
  })

  it('handles three stages', () => {
    expect(splitPipeline('posts | grep a | wc -l')).toHaveLength(3)
  })

  it('reports an empty stage as a nameless one', () => {
    const stages = parsePipeline('ls |')
    expect(stages).toHaveLength(2)
    expect(stages[1].name).toBe('')
  })

  it('parses flags per stage, honouring the valued flags each command claims', () => {
    const stages = parsePipeline('posts --tag design | head -n 3', (n) => (n === 'head' ? ['n'] : []))
    expect(stages[0].flags).toEqual({ tag: 'design' })
    expect(stages[1].flags).toEqual({ n: '3' })
  })

  it('treats a short flag as a boolean when the command does not claim it', () => {
    // `echo -n hello` must keep its operand: only head/tail claim -n.
    const stages = parsePipeline('echo -n hello')
    expect(stages[0].flags).toEqual({ n: true })
    expect(stages[0].args).toEqual(['hello'])
  })

  it('keeps CJK arguments intact across a pipe', () => {
    expect(splitPipeline('find 中文 | wc')).toEqual([['find', '中文'], ['wc']])
  })
})

describe('valued flags', () => {
  it('-c takes the next token as code when the command claims it', () => {
    const p = parseTokens(tokenize("python -c 'print(1)'"), '', ['c'])
    expect(p.flags.c).toBe('print(1)')
    expect(p.args).toEqual([])
  })

  it('-c is a boolean for commands that do not claim it', () => {
    const p = parseLine('grep -c design')
    expect(p.flags.c).toBe(true)
    expect(p.args).toEqual(['design'])
  })

  it('-c stays a boolean when nothing follows it', () => {
    expect(parseLine('wc -c').flags.c).toBe(true)
    expect(parseLine('history -c').flags.c).toBe(true)
  })

  it('-c does not swallow another flag', () => {
    const p = parseLine('wc -c -l')
    expect(p.flags.c).toBe(true)
    expect(p.flags.l).toBe(true)
  })
})
