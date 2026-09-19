import { describe, it, expect } from 'vitest'
import { expandHistory, expandAliasStages, parseAliasArg } from '../src/core/expand.js'
import { splitPipeline } from '../src/core/tokenizer.js'

const history = ['ls posts', 'posts | wc -l', 'grep design', 'theme nord']

describe('history expansion', () => {
  it('leaves a line without a bang alone', () => {
    const r = expandHistory('ls posts', history)
    expect(r.changed).toBe(false)
    expect(r.line).toBe('ls posts')
  })

  it('!! repeats the last command', () => {
    expect(expandHistory('!!', history).line).toBe('theme nord')
  })

  it('!n repeats a numbered command, counting the way history prints it', () => {
    expect(expandHistory('!2', history).line).toBe('posts | wc -l')
  })

  it('!prefix finds the most recent match', () => {
    expect(expandHistory('!gr', history).line).toBe('grep design')
  })

  it('expands inside a longer line', () => {
    expect(expandHistory('!! | wc -l', history).line).toBe('theme nord | wc -l')
  })

  it('reports a reference it cannot find and changes nothing', () => {
    const r = expandHistory('!nope', history)
    expect(r.changed).toBe(false)
    expect(r.missing).toBe('!nope')
    expect(r.line).toBe('!nope')
  })

  it('does nothing with an empty history', () => {
    expect(expandHistory('!!', []).missing).toBe('!!')
  })
})

describe('alias expansion', () => {
  const aliases = { ll: 'ls -l', recent: 'posts | head -n 3' }
  const run = (line: string) => expandAliasStages(splitPipeline(line), aliases)

  it('expands a stage command', () => {
    expect(run('ll')).toEqual([['ls', '-l']])
  })

  it('keeps the arguments that followed it', () => {
    expect(run('ll posts')).toEqual([['ls', '-l', 'posts']])
  })

  it('expands after a pipe as well', () => {
    expect(run('posts | ll')).toEqual([['posts'], ['ls', '-l']])
  })

  it('leaves arguments alone', () => {
    expect(run('grep ll')).toEqual([['grep', 'll']])
  })

  it('does not rewrite an alias name inside a quoted argument', () => {
    expect(run('echo "a | ll"')).toEqual([['echo', 'a | ll']])
  })

  it('an alias containing a pipe becomes several stages', () => {
    expect(run('recent')).toEqual([['posts'], ['head', '-n', '3']])
  })

  it('arguments follow the last stage of a piped alias', () => {
    expect(run('recent extra')).toEqual([['posts'], ['head', '-n', '3', 'extra']])
  })

  it('does not recurse', () => {
    expect(expandAliasStages(splitPipeline('loop'), { loop: 'loop x' })).toEqual([['loop', 'x']])
  })

  it('is a no-op with no aliases', () => {
    expect(expandAliasStages(splitPipeline('ll'), {})).toEqual([['ll']])
  })

  it('ignores an alias whose value is empty', () => {
    expect(expandAliasStages(splitPipeline('bad'), { bad: '   ' })).toEqual([['bad']])
  })
})

describe('alias definitions', () => {
  it('accepts quoted and bare values', () => {
    expect(parseAliasArg("ll='ls -l'")).toEqual({ name: 'll', value: 'ls -l' })
    expect(parseAliasArg('ll=ls -l')).toEqual({ name: 'll', value: 'ls -l' })
    expect(parseAliasArg('ll="ls -l"')).toEqual({ name: 'll', value: 'ls -l' })
  })

  it('rejects malformed definitions', () => {
    expect(parseAliasArg('ll')).toBeNull()
    expect(parseAliasArg('=ls')).toBeNull()
    expect(parseAliasArg('ll=')).toBeNull()
    expect(parseAliasArg('1bad=ls')).toBeNull()
  })
})
