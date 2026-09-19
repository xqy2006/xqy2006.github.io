import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, basename } from 'node:path'
import matter from 'gray-matter'
import type { Plugin } from 'vite'
import { createRenderer } from './markdown.js'
import { plain } from '../src/render/width.js'
import type { Doc, DocBody, Manifest, TocEntry } from '../src/types.js'

/** A document with its prose still attached. Only the build sees these. */
export interface BuiltDoc extends Doc, DocBody { text: string }
export interface BuiltManifest extends Omit<Manifest, 'posts' | 'pages'> {
  posts: BuiltDoc[]
  pages: BuiltDoc[]
}

const INDEX = 'virtual:proseos/content'
const BODIES = 'virtual:proseos/bodies'
const TEXT = 'virtual:proseos/text'
const DOC = 'virtual:proseos/doc/'
const OWNED = (id: string) => id === INDEX || id === BODIES || id === TEXT || id.startsWith(DOC)

const walk = (dir: string): string[] => {
  let out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out = out.concat(walk(p))
    else if (name.endsWith('.md')) out.push(p)
  }
  return out
}

/** A site-relative directory URL: leading slash, trailing slash, no origin. */
const tidyUrl = (u: string): string => `/${u.replace(/^https?:\/\/[^/]+/, '').replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/')

/** Filenames may carry a `YYYY-MM-DD-` prefix; the slug drops it, the date keeps it. */
function splitName(file: string): { slug: string; date: string } {
  const base = basename(file, '.md')
  const m = /^(\d{4}-\d{2}-\d{2})-(.+)$/.exec(base)
  return m ? { date: m[1], slug: m[2] } : { date: '', slug: base }
}

function tableOfContents(html: string): TocEntry[] {
  const out: TocEntry[] = []
  const re = /<h([1-6]) class="md-h md-h\1" id="([^"]*)">.*?<span class="md-h-text">(.*?)<\/span>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) out.push({ depth: +m[1], id: m[2], text: plain(m[3]) })
  return out
}

/** Latin words plus CJK characters; 中文 is counted per glyph, not per space-run. */
function countWords(text: string): number {
  const cjk = (text.match(/[㐀-鿿぀-ヿ가-힯]/g) || []).length
  const latin = (text.replace(/[㐀-鿿぀-ヿ가-힯]/g, ' ').match(/[A-Za-z0-9''\-]+/g) || []).length
  return cjk + latin
}

function readDocs(dir: string, root: string, kind: 'posts' | 'pages', base: string): BuiltDoc[] {
  let files: string[]
  try { files = walk(dir) } catch { return [] }
  const marked = createRenderer(base)

  const docs = files.map((file): BuiltDoc => {
    const raw = readFileSync(file, 'utf8')
    const { data, content } = matter(raw)
    const { slug: fileSlug, date: fileDate } = splitName(file)
    const html = marked.parse(content, { async: false }) as string
    const text = plain(html).replace(/\n{3,}/g, '\n\n').trim()
    const slug = String(data.slug || fileSlug)
    const date = String(data.date ? new Date(data.date).toISOString().slice(0, 10) : fileDate)
    const words = countWords(text)
    const year = date.slice(0, 4)
    // A document imported from somewhere else keeps the URL it was indexed
    // under; that address is the canonical one, and the address this site
    // would have given it becomes an alias. Nothing that was linked moves.
    const natural = kind === 'posts' ? `/posts/${slug}/` : `/${slug}/`
    const permalink = typeof data.permalink === 'string' ? tidyUrl(data.permalink) : ''
    const extra = Array.isArray(data.aliases) ? data.aliases.map(String).map(tidyUrl) : []
    const url = permalink || natural
    const aliases = [...new Set([...(permalink ? [natural] : []), ...extra])].filter((a) => a !== url)
    return {
      slug,
      url,
      aliases,
      bytes: text.length,
      title: String(data.title || slug),
      summary: String(data.summary || ''),
      lang: String(data.lang || 'en'),
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      date,
      path: kind === 'posts' ? `/posts/${year}/${slug}.md` : `/${slug}.md`,
      html,
      text,
      toc: tableOfContents(html),
      words,
      minutes: Math.max(1, Math.round(words / 220)),
      // keep the source path out of the bundle, it is only used for logging
      ...(process.env.PROSEOS_DEBUG ? { file: relative(root, file) } : {}),
    }
  })

  return kind === 'posts'
    ? docs.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)))
    : docs.sort((a, b) => a.slug.localeCompare(b.slug))
}

export function buildManifest(root: string, base = '/'): BuiltManifest {
  const posts = readDocs(join(root, 'content/posts'), root, 'posts', base)
  const pages = readDocs(join(root, 'content/pages'), root, 'pages', base)
  const tags: Record<string, string[]> = {}
  for (const p of posts) for (const t of p.tags) (tags[t] ||= []).push(p.slug)
  return { posts, pages, tags, builtAt: new Date().toISOString() }
}

export function contentPlugin(): Plugin {
  let root = process.cwd()
  let base = '/'
  let cache: BuiltManifest | null = null
  const get = () => (cache ||= buildManifest(root, base))

  return {
    name: 'proseos:content',
    configResolved(c) { root = c.root; base = c.base },
    resolveId(id) { return OWNED(id) ? '\0' + id : null },
    load(id) {
      if (!id.startsWith('\0')) return null
      const real = id.slice(1)
      if (!OWNED(real)) return null
      const m = get()
      const all = [...m.posts, ...m.pages]

      // The index: everything the listing needs, and nothing it does not.
      // This is the only one of these modules that lands in the entry bundle.
      if (real === INDEX) {
        const strip = ({ html, text, toc, ...rest }: BuiltDoc): Doc => rest
        this.info?.(`${m.posts.length} posts, ${m.pages.length} pages, ` +
          `${Math.round(all.reduce((n, d) => n + d.html.length, 0) / 1024)}K of prose in ${all.length} chunks`)
        return `export default ${JSON.stringify({ ...m, posts: m.posts.map(strip), pages: m.pages.map(strip) })}`
      }

      // One dynamic import per document, which is one chunk per document:
      // opening a post fetches that post, the way a routed site would.
      if (real === BODIES) {
        return 'export default {\n' +
          all.map((d) => `  ${JSON.stringify(d.slug)}: () => import(${JSON.stringify(DOC + d.slug)}),`).join('\n') +
          '\n}\n'
      }

      // `find` and `grep` read every document, so their text is one chunk, and
      // it only loads when something actually searches.
      if (real === TEXT) {
        return `export default ${JSON.stringify(Object.fromEntries(all.map((d) => [d.slug, d.text])))}`
      }

      const doc = all.find((d) => d.slug === real.slice(DOC.length))
      if (!doc) return null
      return `export default ${JSON.stringify({ html: doc.html, toc: doc.toc } satisfies DocBody)}`
    },
    configureServer(server) {
      const dir = join(root, 'content')
      server.watcher.add(dir)
      const bust = (file: string) => {
        if (!file.startsWith(dir) || !file.endsWith('.md')) return
        cache = null
        for (const [id, mod] of server.moduleGraph.idToModuleMap) {
          if (id.startsWith('\0virtual:proseos/')) server.moduleGraph.invalidateModule(mod)
        }
        server.ws.send({ type: 'full-reload' })
        server.config.logger.info(`  content reloaded: ${relative(root, file)}`)
      }
      server.watcher.on('add', bust)
      server.watcher.on('change', bust)
      server.watcher.on('unlink', bust)
    },
  }
}

export { INDEX as VIRTUAL }
