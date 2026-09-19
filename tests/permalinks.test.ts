import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildManifest } from '../build/content.js'
import { siteUrl } from '../build/static-pages.js'

let root: string

const post = (name: string, front: string, body = 'hello') =>
  writeFileSync(join(root, 'content/posts', name), `---\n${front}\n---\n\n${body}\n`)

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'proseos-'))
  mkdirSync(join(root, 'content/posts'), { recursive: true })
  mkdirSync(join(root, 'content/pages'), { recursive: true })
  post('plain.md', 'title: Plain\ndate: 2026-01-01')
  post('moved.md', 'title: Moved\ndate: 2026-01-02\npermalink: /article/mr82j248/')
  post('untidy.md', 'title: Untidy\ndate: 2026-01-03\npermalink: article/no-slashes')
  post('absolute.md', 'title: Absolute\ndate: 2026-01-04\npermalink: https://old.example/article/x/')
  post('extra.md', 'title: Extra\ndate: 2026-01-05\naliases: [/old/one/, /old/two/]')
  writeFileSync(join(root, 'content/pages', 'about.md'), '---\ntitle: About\n---\n\nhi\n')
})
afterAll(() => rmSync(root, { recursive: true, force: true }))

const bySlug = (slug: string) => {
  const m = buildManifest(root)
  return [...m.posts, ...m.pages].find((d) => d.slug === slug)!
}

describe('a document without a permalink', () => {
  it('lives where this site would put it', () => {
    expect(bySlug('plain').url).toBe('/posts/plain/')
    expect(bySlug('plain').aliases).toEqual([])
  })

  it('and a page lives at the root', () => {
    expect(bySlug('about').url).toBe('/about/')
  })
})

describe('a document carrying a permalink', () => {
  it('keeps the address it was indexed under as the canonical one', () => {
    expect(bySlug('moved').url).toBe('/article/mr82j248/')
  })

  it('and answers to this site’s address as well', () => {
    expect(bySlug('moved').aliases).toEqual(['/posts/moved/'])
  })

  it('tidies a permalink written without slashes', () => {
    expect(bySlug('untidy').url).toBe('/article/no-slashes/')
  })

  it('takes the path out of a permalink written as a full URL', () => {
    expect(bySlug('absolute').url).toBe('/article/x/')
  })
})

describe('extra aliases', () => {
  it('are kept alongside the natural address', () => {
    const doc = bySlug('extra')
    expect(doc.url).toBe('/posts/extra/')
    expect(doc.aliases).toEqual(['/old/one/', '/old/two/'])
  })

  it('never repeat the canonical url', () => {
    for (const d of buildManifest(root).posts) expect(d.aliases).not.toContain(d.url)
  })
})

describe('the addresses the build writes', () => {
  // A sitemap <loc> must be a full URL. `site.origin` is the only thing that
  // can supply the host, and leaving it empty is the one way to emit a
  // sitemap a crawler is entitled to drop.
  it('are absolute once an origin is set', () => {
    const abs = siteUrl('https://blog.example', '/')
    expect(abs('/article/x/')).toBe('https://blog.example/article/x/')
    expect(abs('/')).toBe('https://blog.example/')
  })

  it('carry the base path of a project site', () => {
    const abs = siteUrl('https://example.github.io', '/repo/')
    expect(abs('/article/x/')).toBe('https://example.github.io/repo/article/x/')
    expect(abs('/')).toBe('https://example.github.io/repo/')
  })

  it('fall back to site-relative without an origin', () => {
    const abs = siteUrl('', '/')
    expect(abs('/article/x/')).toBe('/article/x/')
    expect(abs('/')).toBe('/')
  })

  it('do not double the slash after the host', () => {
    expect(siteUrl('https://blog.example/', '/')('/x/')).toBe('https://blog.example/x/')
  })
})
