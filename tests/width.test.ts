import { describe, it, expect } from 'vitest'
import { width, padEnd, truncate, columnize, plain } from '../src/render/width.js'

describe('display width', () => {
  it('counts CJK as two cells', () => {
    expect(width('abc')).toBe(3)
    expect(width('中文')).toBe(4)
    expect(width('a中b')).toBe(4)
  })

  it('pads to visual width, not code-unit length', () => {
    expect(width(padEnd('中文', 10))).toBe(10)
    expect(width(padEnd('abcd', 10))).toBe(10)
    // the naive version would produce different widths for these two
    expect(width(padEnd('中文', 10))).toBe(width(padEnd('abcd', 10)))
  })

  it('truncates without splitting a wide glyph past the budget', () => {
    expect(width(truncate('一二三四五六', 7))).toBeLessThanOrEqual(7)
  })

  it('columnizes to a bounded width', () => {
    const lines = columnize(['a', 'bb', '中文', 'dddd', 'e'], 40)
    for (const l of lines) expect(width(l)).toBeLessThanOrEqual(40)
  })

  it('strips tags and decodes entities for measurement', () => {
    expect(plain('<a href="#">中文</a>')).toBe('中文')
    expect(plain('a &amp; b')).toBe('a & b')
  })
})
