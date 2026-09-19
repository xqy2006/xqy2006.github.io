import { describe, it, expect, beforeEach } from 'vitest'
import { Vfs } from '../src/core/vfs.js'
import type { Doc, Manifest } from '../src/types.js'

const doc = (slug: string, date: string, path: string, lang = 'en'): Doc => ({
  slug, title: slug, summary: '', lang, tags: [], date, path,
  url: `/posts/${slug}/`, aliases: [], bytes: `body of ${slug}`.length, words: 3, minutes: 1,
})

const manifest: Manifest = {
  posts: [
    doc('terminal-aesthetics', '2026-04-12', '/posts/2026/terminal-aesthetics.md'),
    doc('chinese-typography', '2026-03-02', '/posts/2026/chinese-typography.md', 'zh'),
    doc('older', '2025-01-01', '/posts/2025/older.md'),
  ],
  pages: [doc('about', '', '/about.md')],
  tags: {},
  builtAt: '2026-09-18T00:00:00.000Z',
}

describe('vfs', () => {
  let vfs: Vfs
  beforeEach(() => { vfs = new Vfs(manifest) })

  it('builds year directories from post paths', () => {
    const top = vfs.list('/')!.map((n) => n.name)
    expect(top).toContain('posts')
    expect(top).toContain('about.md')
    expect(vfs.list('/posts')!.map((n) => n.name)).toEqual(['2025', '2026'])
  })

  it('lists directories before files', () => {
    const kinds = vfs.list('/')!.map((n) => n.kind)
    expect(kinds.indexOf('dir')).toBeLessThan(kinds.indexOf('file'))
  })

  it('normalizes . and .. against cwd', () => {
    vfs.chdir('/posts/2026')
    expect(vfs.normalize('..')).toBe('/posts')
    expect(vfs.normalize('./x')).toBe('/posts/2026/x')
    expect(vfs.normalize('/abs')).toBe('/abs')
  })

  it('refuses to cd into a file', () => {
    const res = vfs.chdir('/about.md')
    expect(res.ok).toBe(false)
  })

  it('does not escape above the root', () => {
    vfs.chdir('/')
    expect(vfs.normalize('../../..')).toBe('/')
  })

  it('resolves a doc by slug, path or unique fragment', () => {
    expect(vfs.resolveDoc('older')?.slug).toBe('older')
    expect(vfs.resolveDoc('/posts/2025/older.md')?.slug).toBe('older')
    expect(vfs.resolveDoc('chinese')?.slug).toBe('chinese-typography')
    expect(vfs.resolveDoc('older.md')?.slug).toBe('older')
  })

  it('returns null for an ambiguous or missing reference', () => {
    expect(vfs.resolveDoc('nope')).toBeNull()
    expect(vfs.list('/nowhere')).toBeNull()
  })

  it('exposes every path for completion', () => {
    const paths = vfs.paths()
    expect(paths).toContain('/posts/2026/chinese-typography.md')
    expect(paths).toContain('/posts')
  })
})
