import { describe, it, expect } from 'vitest'
import { applyGrep, applyHead, applyTail, applySort, applyUniq, applyWc } from '../src/commands/filters.js'

const lines = ['banana', 'apple', 'Cherry', 'apple', 'date']

describe('grep', () => {
  it('matches case-insensitively on a substring', () => {
    expect(applyGrep(lines, 'app')).toEqual(['apple', 'apple'])
    expect(applyGrep(lines, 'CHERRY')).toEqual(['Cherry'])
  })

  it('inverts with -v', () => {
    expect(applyGrep(lines, 'apple', true)).toEqual(['banana', 'Cherry', 'date'])
  })

  it('returns nothing when nothing matches', () => {
    expect(applyGrep(lines, 'zzz')).toEqual([])
  })

  it('matches CJK', () => {
    expect(applyGrep(['中文排版', 'latin'], '排版')).toEqual(['中文排版'])
  })
})

describe('head and tail', () => {
  it('takes from each end', () => {
    expect(applyHead(lines, 2)).toEqual(['banana', 'apple'])
    expect(applyTail(lines, 2)).toEqual(['apple', 'date'])
  })

  it('handles counts beyond the input', () => {
    expect(applyHead(lines, 99)).toEqual(lines)
    expect(applyTail(lines, 99)).toEqual(lines)
  })

  it('handles zero and negative counts', () => {
    expect(applyHead(lines, 0)).toEqual([])
    expect(applyTail(lines, 0)).toEqual([])
    expect(applyHead(lines, -3)).toEqual([])
    expect(applyTail(lines, -3)).toEqual([])
  })
})

describe('sort and uniq', () => {
  it('sorts and reverses', () => {
    expect(applySort(['b', 'a', 'c'])).toEqual(['a', 'b', 'c'])
    expect(applySort(['b', 'a', 'c'], true)).toEqual(['c', 'b', 'a'])
  })

  it('does not mutate its input', () => {
    const src = ['b', 'a']
    applySort(src)
    expect(src).toEqual(['b', 'a'])
  })

  it('collapses adjacent duplicates only, like the real uniq', () => {
    expect(applyUniq(['a', 'a', 'b', 'a'])).toEqual(['a', 'b', 'a'])
    expect(applyUniq(applySort(['a', 'a', 'b', 'a']))).toEqual(['a', 'b'])
  })
})

describe('wc', () => {
  it('counts lines, words and characters by default', () => {
    expect(applyWc(['one two', 'three'])).toBe('2 3 13')
  })

  it('honours a single flag', () => {
    expect(applyWc(['a', 'b', 'c'], { lines: true })).toBe('3')
    expect(applyWc(['one two three'], { words: true })).toBe('3')
  })

  it('combines flags in a fixed order', () => {
    expect(applyWc(['one two'], { lines: true, words: true })).toBe('1 2')
  })

  it('counts an empty pipe as zero lines', () => {
    expect(applyWc([], { lines: true })).toBe('0')
  })
})
