import { describe, it, expect } from 'vitest'
import { renderBanner, bannerWidth, boxed } from '../src/render/figlet.js'
import { width } from '../src/render/width.js'

describe('block banner', () => {
  it('renders five rows', () => {
    expect(renderBanner('PROSEOS')).toHaveLength(5)
  })

  it('renders every row at the advertised width', () => {
    const rows = renderBanner('PROSEOS')
    const w = bannerWidth('PROSEOS')
    expect(w).toBe(7 * 5 + 6)
    for (const r of rows) expect(width(r)).toBe(w)
  })

  it('is case-insensitive', () => {
    expect(renderBanner('ab')).toEqual(renderBanner('AB'))
  })

  it('renders unknown characters as blanks rather than dropping them', () => {
    const rows = renderBanner('A@')
    expect(width(rows[0])).toBe(bannerWidth('A@'))
  })

  it('handles an empty string', () => {
    expect(renderBanner('')).toEqual([])
    expect(bannerWidth('')).toBe(0)
  })
})

describe('boxed', () => {
  it('produces a rectangle', () => {
    const box = boxed(['ab', 'longer line'])
    const widths = new Set(box.map(width))
    expect([...widths]).toHaveLength(1)
    expect(box[0].startsWith('┌')).toBe(true)
    expect(box[box.length - 1].startsWith('└')).toBe(true)
  })

  it('stays rectangular with CJK content', () => {
    const box = boxed(['中文标题', 'abc'])
    expect([...new Set(box.map(width))]).toHaveLength(1)
  })

  it('tucks a footer into the bottom rule without changing the width', () => {
    const plain = boxed(['content here'])
    const withFooter = boxed(['content here'], { footer: '12 posts' })
    expect(width(withFooter[withFooter.length - 1])).toBe(width(plain[plain.length - 1]))
    expect(withFooter[withFooter.length - 1]).toContain('12 posts')
  })

  it('drops a footer that would not fit', () => {
    const box = boxed(['x'], { footer: 'a very long footer indeed' })
    expect([...new Set(box.map(width))]).toHaveLength(1)
  })
})
