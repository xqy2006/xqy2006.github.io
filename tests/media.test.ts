import { describe, it, expect } from 'vitest'
import { quantize, toHtml, type Pixels } from '../src/render/media.js'
import { themes } from '../src/core/theme.js'

/** Build a solid block of pixels, w x h, RGBA. */
const solid = (w: number, h: number, r: number, g: number, b: number, a = 255): Pixels => {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a
  }
  return { data, w, h }
}

const theme = themes.anthropic

describe('quantizer', () => {
  it('produces one cell row per two pixel rows', () => {
    const art = quantize(solid(8, 6, 0, 0, 0), theme, 16)
    expect(art.cols).toBe(8)
    expect(art.rows).toBe(3)
    expect(art.top.length).toBe(24)
  })

  it('maps white and black to opposite ends of the ramp', () => {
    const white = quantize(solid(4, 2, 255, 255, 255), theme, 16)
    const black = quantize(solid(4, 2, 0, 0, 0), theme, 16)
    expect(white.top[0]).toBe(15)
    expect(black.top[0]).toBeLessThanOrEqual(8)
    expect(white.top[0]).not.toBe(black.top[0])
  })

  it('keeps every 16-colour index inside the palette', () => {
    const art = quantize(solid(16, 8, 120, 90, 60), theme, 16)
    for (const v of art.top) expect(v).toBeGreaterThanOrEqual(0)
    for (const v of art.top) expect(v).toBeLessThan(16)
  })

  it('uses the full 256 palette in 256 mode', () => {
    const art = quantize(solid(4, 2, 12, 200, 90), theme, 256)
    expect(art.top[0]).toBeLessThan(256)
  })

  it('packs literal rgb in truecolor mode', () => {
    const art = quantize(solid(2, 2, 0x12, 0x34, 0x56), theme, 'true')
    expect(art.top[0]).toBe(0x123456)
  })

  it('composites transparency over the theme background', () => {
    const art = quantize(solid(2, 2, 0, 0, 0, 0), theme, 'true')
    const bg = parseInt(theme.bg.slice(1), 16)
    expect(art.top[0]).toBe(bg)
  })

  it('dithers a colour that falls between palette slots', () => {
    const art = quantize(solid(8, 8, 180, 60, 200), theme, 16)
    expect(new Set(art.top).size).toBeGreaterThan(1)
  })

  it('leaves a flat colour that matches a slot undithered', () => {
    // #D97757 is slot 9 exactly; it must not shimmer.
    const art = quantize(solid(8, 8, 0xd9, 0x77, 0x57), theme, 16)
    expect(new Set(art.top)).toEqual(new Set([9]))
  })
})

describe('art markup', () => {
  it('emits palette classes and never a literal colour in indexed mode', () => {
    const html = toHtml(quantize(solid(4, 2, 200, 100, 50), theme, 16))
    expect(html).toMatch(/class="f\d+ b\d+"/)
    expect(html).not.toMatch(/#[0-9a-f]{6}/i)
    expect(html).toContain('▀')
  })

  it('emits literal colour only in truecolor mode', () => {
    const html = toHtml(quantize(solid(2, 2, 0x12, 0x34, 0x56), theme, 'true'))
    expect(html).toContain('#123456')
  })

  it('hides art from assistive technology', () => {
    expect(toHtml(quantize(solid(2, 2, 0, 0, 0), theme, 16))).toContain('aria-hidden="true"')
  })

  it('emits one line per cell row', () => {
    const html = toHtml(quantize(solid(6, 10, 30, 30, 30), theme, 16))
    const body = /<pre[^>]*>([\s\S]*)<\/pre>/.exec(html)![1]
    expect(body.split('\n')).toHaveLength(5)
  })
})
