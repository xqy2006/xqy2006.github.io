import { describe, it, expect } from 'vitest'
import { createRenderer } from '../build/markdown.js'
import { width, plain } from '../src/render/width.js'

const render = (md: string) => createRenderer().parse(md, { async: false }) as string

describe('terminal markdown renderer', () => {
  it('keeps a mixed CJK/Latin table square', () => {
    const html = render([
      '| font | 汉字 2:1 | size |',
      '|------|----------|------|',
      '| JetBrains Mono | 无字形 | small |',
      '| Maple Mono CN | 是 | 较大 |',
    ].join('\n'))
    const pre = /<pre class="md-table">([\s\S]*?)<\/pre>/.exec(html)
    expect(pre).not.toBeNull()
    const lines = plain(pre![1]).split('\n')
    expect(lines.length).toBe(6)
    const widths = new Set(lines.map(width))
    expect([...widths]).toHaveLength(1) // every row is the same number of cells
    expect(lines[0].startsWith('┌')).toBe(true)
    expect(lines[5].startsWith('└')).toBe(true)
  })

  it('prefixes headings with hashes and gives them ids', () => {
    const html = render('## Why a prompt\n')
    expect(html).toContain('<span class="md-hash" aria-hidden="true">## </span>')
    expect(html).toContain('id="why-a-prompt"')
  })

  it('ids survive Chinese headings', () => {
    expect(render('# 中文排版\n')).toContain('id="中文排版"')
  })

  it('highlights code with classes, never inline colour', () => {
    const html = render('```ts\nconst a: number = 1\n```')
    expect(html).toContain('hljs')
    expect(html).toContain('class="hljs-keyword"')
    expect(html).not.toMatch(/style="[^"]*#[0-9a-f]{3,6}/i)
  })

  it('falls back cleanly for an unknown language', () => {
    const html = render('```notalang\nplain\n```')
    expect(html).toContain('>notalang<')
    expect(html).toContain('plain')
  })

  it('emits media as an upgradeable figure that still works without JS', () => {
    const html = render('![alt text](/media/x.png "cap")')
    expect(html).toContain('data-kind="image"')
    expect(html).toContain('<img class="md-img"')
    expect(html).toContain('loading="lazy"')
  })

  it('treats mp4 as video, not an image', () => {
    const html = render('![clip](/media/demo.mp4)')
    expect(html).toContain('data-kind="video"')
    expect(html).toContain('<video')
  })

  it('marks external links and leaves internal ones for the router', () => {
    expect(render('[x](https://example.com)')).toContain('target="_blank"')
    expect(render('[x](/posts/y)')).toContain('data-internal="1"')
  })

  it('escapes HTML in code spans', () => {
    expect(render('`<script>`')).toContain('&lt;script&gt;')
  })
})
