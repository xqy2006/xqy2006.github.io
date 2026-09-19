import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { buildManifest, type BuiltDoc } from './content.js'
import site from '../site.config.js'

export const SLOT = '<!--PROSEOS_PRERENDER-->'

export interface ShellFill {
  /** Already-escaped title text. */
  title?: string
  lang?: string
  /** Already-escaped <head> additions. */
  head?: string
  /** Trusted HTML for the prerender slot. */
  body: string
}

/**
 * Put content into the built index.html.
 *
 * Every substitution goes through a replacer function rather than a
 * replacement string. In a replacement string `$&` inserts the match and
 * `` $` `` inserts everything before it — so a post that mentions shell
 * variables, which on this blog is likely, would splice the document head
 * into the middle of its own article.
 */
export function fillShell(shell: string, fill: ShellFill): string {
  let out = shell
  if (fill.title !== undefined) {
    const head = fill.head ? `\n    ${fill.head}` : ''
    out = out.replace(/<title>[^<]*<\/title>/, () => `<title>${fill.title}</title>${head}`)
  }
  if (fill.lang) out = out.replace('<html lang="en"', () => `<html lang="${fill.lang}"`)
  return out.replace(SLOT, () => fill.body)
}
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Absolute where it can be, site-relative where it cannot.
 *
 * A sitemap `<loc>` and an RSS `<link>` are both specified as full URLs, and
 * a crawler is within its rights to ignore anything less. `origin` is the only
 * thing that can supply the host, because a static build has no request to
 * learn it from.
 */
export const siteUrl = (origin: string, base: string) => {
  const host = origin.replace(/\/$/, '')
  const prefix = base.replace(/\/$/, '')
  return (path: string): string => host + ((prefix + path) || '/')
}

let abs = (p: string) => p

/**
 * Every post also exists as a real HTML file, so links are shareable and
 * crawlers see prose rather than an empty terminal. The client boots from
 * location.pathname and opens the pager on the matching document.
 */
export function staticPagesPlugin(): Plugin {
  let outDir = 'dist'
  let root = process.cwd()
  let base = '/'

  return {
    name: 'proseos:static-pages',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir
      root = c.root
      base = c.base
    },
    closeBundle() {
      const dist = join(root, outDir)
      const indexPath = join(dist, 'index.html')
      if (!existsSync(indexPath)) return
      const shell = readFileSync(indexPath, 'utf8')
      const manifest = buildManifest(root, base)
      abs = siteUrl(site.origin, base)

      /**
       * Every address a document answers to gets a real page with the whole
       * article in it, all of them naming `doc.url` as canonical. An imported
       * post keeps the URL it was indexed under and gains this site's, and a
       * reader arriving at either one is reading, not being redirected.
       */
      const emit = (doc: BuiltDoc) => {
        const desc = doc.summary || doc.text.slice(0, 160).replace(/\s+/g, ' ')
        const head = [
          `<meta name="description" content="${esc(desc)}">`,
          `<link rel="canonical" href="${esc(abs(doc.url))}">`,
          `<meta property="og:title" content="${esc(doc.title)}">`,
          `<meta property="og:description" content="${esc(desc)}">`,
          `<meta property="og:type" content="article">`,
          doc.date ? `<meta property="article:published_time" content="${doc.date}">` : '',
        ].filter(Boolean).join('\n    ')

        const html = fillShell(shell, {
          title: `${esc(doc.title)} · ${esc(site.title)}`,
          lang: esc(doc.lang),
          head,
          body: `<article class="md" data-slug="${esc(doc.slug)}">${doc.html}</article>`,
        })

        for (const url of [doc.url, ...doc.aliases]) {
          const dest = join(dist, ...url.split('/').filter(Boolean))
          mkdirSync(dest, { recursive: true })
          writeFileSync(join(dest, 'index.html'), html)
        }
      }

      for (const p of [...manifest.posts, ...manifest.pages]) emit(p)

      // Landing page: list the posts so the root URL is not empty to a crawler.
      const list = manifest.posts
        .map((p) => `<li><a href="${abs(p.url)}">${esc(p.date)} — ${esc(p.title)}</a></li>`)
        .join('\n')
      writeFileSync(indexPath, fillShell(shell, {
        body: `<nav class="md"><h1>${esc(site.title)}</h1><ul>${list}</ul></nav>`,
      }))

      // GitHub Pages serves 404.html for unknown paths; make it boot the app.
      writeFileSync(join(dist, '404.html'), fillShell(shell, { body: '' }))

      const rfc = (d: string) => (d ? new Date(d + 'T00:00:00Z').toUTCString() : '')
      writeFileSync(join(dist, 'feed.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n` +
        `<title>${esc(site.title)}</title>\n<description>${esc(site.description)}</description>\n` +
        `<link>${esc(abs('/'))}</link>\n` +
        manifest.posts.map((p) =>
          `<item><title>${esc(p.title)}</title><link>${esc(abs(p.url))}</link>` +
          `<guid isPermaLink="true">${esc(abs(p.url))}</guid>` +
          (p.date ? `<pubDate>${rfc(p.date)}</pubDate>` : '') +
          `<description>${esc(p.summary || p.text.slice(0, 300))}</description></item>`).join('\n') +
        `\n</channel></rss>\n`)

      writeFileSync(join(dist, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        // Canonical addresses only. An alias is a way in, not a second page
        // to index, and its own markup says so.
        [abs('/'), ...manifest.posts.map((p) => abs(p.url)), ...manifest.pages.map((p) => abs(p.url))]
          .map((u) => `<url><loc>${esc(u)}</loc></url>`).join('\n') +
        `\n</urlset>\n`)

      const all = [...manifest.posts, ...manifest.pages]
      const aliases = all.reduce((n, d) => n + d.aliases.length, 0)
      this.info?.(`static pages: ${all.length}${aliases ? ` (+${aliases} aliases)` : ''} + feed + sitemap`)
    },
  }
}
