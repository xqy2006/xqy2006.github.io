import { Marked, type Tokens } from 'marked'
import hljs from 'highlight.js'
import { BOX, padEnd, padStart, center, plain, width } from '../src/render/width.js'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const VIDEO = /\.(mp4|webm|ogv|mov)$/i
const AUDIO = /\.(mp3|ogg|wav|flac|m4a)$/i

/**
 * `#` prefixes, box-drawn tables, media placeholders: Markdown as terminal
 * output.
 *
 * `base` is the deploy base path. Root-relative URLs written in Markdown are
 * rewritten onto it, because these end up both in the JSON manifest and in the
 * prerendered static pages, neither of which Vite rewrites for us — without
 * this every image and internal link 404s on a project-site deploy.
 */
export function createRenderer(base = '/') {
  const prefix = base.replace(/\/$/, '')
  const rebase = (url: string) =>
    prefix && url.startsWith('/') && !url.startsWith('//') ? prefix + url : url
  const marked = new Marked({ gfm: true, breaks: false })

  marked.use({
    renderer: {
      heading({ tokens, depth }: Tokens.Heading) {
        const text = this.parser.parseInline(tokens)
        const id = plain(text).toLowerCase().trim().replace(/[^\w一-鿿]+/g, '-').replace(/^-|-$/g, '')
        const hash = '#'.repeat(depth)
        return `<h${depth} class="md-h md-h${depth}" id="${esc(id)}">` +
          `<span class="md-hash" aria-hidden="true">${hash} </span>` +
          `<span class="md-h-text">${text}</span></h${depth}>\n`
      },

      /**
       * A paragraph that is nothing but media is unwrapped.
       *
       * Media is a <span> rather than a <figure> because marked wraps an
       * inline image in a paragraph, and <figure> is not permitted there —
       * the parser closes the <p> at the figure and strands whatever text
       * followed the image. A span is valid either way; this only removes the
       * pointless wrapper when the paragraph holds nothing else.
       */
      paragraph({ tokens }: Tokens.Paragraph) {
        const inner = this.parser.parseInline(tokens)
        return /^\s*<span class="md-media"[\s\S]*<\/span>\s*$/.test(inner)
          ? `${inner}\n`
          : `<p>${inner}</p>\n`
      },

      hr() {
        return `<div class="md-hr" role="separator"></div>\n`
      },

      blockquote({ tokens }: Tokens.Blockquote) {
        return `<blockquote class="md-quote">${this.parser.parse(tokens)}</blockquote>\n`
      },

      code({ text, lang }: Tokens.Code) {
        const language = (lang || '').trim().split(/\s+/)[0]
        let body: string
        let shown = language
        if (language && hljs.getLanguage(language)) {
          body = hljs.highlight(text, { language, ignoreIllegals: true }).value
        } else {
          body = esc(text)
          shown = language || 'text'
        }
        const lines = text.split('\n').length
        return `<div class="md-code">` +
          `<div class="md-code-bar"><span class="md-code-lang">${esc(shown)}</span>` +
          `<span class="md-code-meta">${lines} ${lines === 1 ? 'line' : 'lines'}</span>` +
          `<button class="md-code-copy" type="button" data-copy>copy</button></div>` +
          `<pre class="md-code-body"><code class="hljs language-${esc(shown)}">${body}</code></pre>` +
          `</div>\n`
      },

      listitem(item: Tokens.ListItem) {
        const inner = this.parser.parse(item.tokens)
        if (item.task) {
          const mark = item.checked ? '[x]' : '[ ]'
          return `<li class="md-li md-task${item.checked ? ' is-done' : ''}">` +
            `<span class="md-check" aria-hidden="true">${mark}</span>${inner}</li>\n`
        }
        return `<li class="md-li">${inner}</li>\n`
      },

      list(token: Tokens.List) {
        const body = token.items.map((i) => this.listitem(i)).join('')
        if (token.ordered) {
          const start = token.start === '' || token.start === 1 ? '' : ` start="${token.start}"`
          return `<ol class="md-list md-ol"${start}>${body}</ol>\n`
        }
        return `<ul class="md-list md-ul">${body}</ul>\n`
      },

      codespan({ text }: Tokens.Codespan) {
        return `<code class="md-code-inline">${esc(text)}</code>`
      },

      link({ href: rawHref, title, tokens }: Tokens.Link) {
        const label = this.parser.parseInline(tokens)
        const external = /^[a-z]+:\/\//i.test(rawHref)
        const href = external ? rawHref : rebase(rawHref)
        const attrs = external
          ? ` target="_blank" rel="noopener noreferrer"`
          : ` data-internal="1"`
        const t = title ? ` title="${esc(title)}"` : ''
        const mark = external ? `<span class="md-link-ext" aria-hidden="true">↗</span>` : ''
        return `<a class="md-link" href="${esc(href)}"${attrs}${t}>${label}${mark}</a>`
      },

      /**
       * Emitted with a real <img>/<video> so crawlers and no-JS readers get the
       * media; the client upgrades the <figure> in place into half-block art.
       */
      image({ href: rawHref, title, text }: Tokens.Image) {
        const href = /^[a-z]+:\/\//i.test(rawHref) ? rawHref : rebase(rawHref)
        const alt = esc(text || '')
        const cap = title ? esc(title) : alt
        const name = href.split('/').pop() || href
        if (VIDEO.test(href)) {
          return `<span class="md-media" data-kind="video" data-src="${esc(href)}" data-name="${esc(name)}">` +
            `<video class="md-video" controls preload="metadata" playsinline src="${esc(href)}"></video>` +
            (cap ? `<span class="md-caption">${cap}</span>` : '') + `</span>`
        }
        if (AUDIO.test(href)) {
          return `<span class="md-media" data-kind="audio" data-src="${esc(href)}" data-name="${esc(name)}">` +
            `<audio class="md-audio" controls preload="metadata" src="${esc(href)}"></audio>` +
            (cap ? `<span class="md-caption">${cap}</span>` : '') + `</span>`
        }
        return `<span class="md-media" data-kind="image" data-src="${esc(href)}" data-name="${esc(name)}" data-alt="${alt}">` +
          `<img class="md-img" src="${esc(href)}" alt="${alt}" loading="lazy" decoding="async">` +
          (cap ? `<span class="md-caption">${cap}</span>` : '') + `</span>`
      },

      /**
       * Tables are drawn with box characters into a <pre>, padded by display
       * width. That is the only way the Chinese post's table stays square.
       */
      table(token: Tokens.Table) {
        const head = token.header.map((c) => this.parser.parseInline(c.tokens))
        const rows = token.rows.map((r) => r.map((c) => this.parser.parseInline(c.tokens)))
        const aligns = token.align
        const cols = head.length
        const w: number[] = []
        for (let c = 0; c < cols; c++) {
          w[c] = Math.max(
            width(plain(head[c] ?? '')),
            ...rows.map((r) => width(plain(r[c] ?? ''))),
          )
        }
        const fit = (html: string, c: number) => {
          const gap = w[c] - width(plain(html))
          const a = aligns[c]
          if (a === 'right') return ' '.repeat(gap) + html
          if (a === 'center') {
            const l = Math.floor(gap / 2)
            return ' '.repeat(l) + html + ' '.repeat(gap - l)
          }
          return html + ' '.repeat(gap)
        }
        const rule = (l: string, m: string, r: string) =>
          l + w.map((n) => BOX.h.repeat(n + 2)).join(m) + r
        const line = (cells: string[]) =>
          BOX.v + cells.map((h, c) => ` ${fit(h, c)} `).join(BOX.v) + BOX.v

        const out = [
          rule(BOX.tl, BOX.teeDown, BOX.tr),
          `<span class="md-th">${line(head)}</span>`,
          rule(BOX.teeRight, BOX.cross, BOX.teeLeft),
          ...rows.map((r) => line(head.map((_, c) => r[c] ?? ''))),
          rule(BOX.bl, BOX.teeUp, BOX.br),
        ]
        return `<div class="md-table-wrap"><pre class="md-table">${out.join('\n')}</pre></div>\n`
      },
    },
  })

  return marked
}

export { padEnd, padStart, center }
