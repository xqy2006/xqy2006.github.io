import type { Doc } from '../types.js'
import { escapeHtml } from '../core/terminal.js'
import { buildScreen, type Screen } from '../core/screens.js'
import { ListView } from '../render/postlist.js'
import { renderBanner, bannerWidth, boxed } from '../render/figlet.js'
import { truncate } from '../render/width.js'

export interface BlogOptions {
  title: string
  description: string
  perPage: number
  onOpen: (doc: Doc) => void
  onPage: (page: number) => void
  /** The highlight moved. Used to fetch a post's chunk before it is opened. */
  onSelect?: (doc: Doc) => void
  /** `q`: hand the screen back to the shell. */
  onQuit: () => void
  /** A "powered by" line under the listing, or null for none. */
  credit?: { show: boolean; url: string } | null
  /** A tappable token under the masthead. */
  onCommand: (line: string) => void
}

export interface BlogView {
  docs: Doc[]
  /** Shown in the title bar and the footer, e.g. 'posts' or 'tagged design'. */
  label: string
  page?: number
}

/**
 * The blog, as a program. It owns the whole screen and the whole keyboard
 * while it runs, so the arrow keys are unambiguously about posts — the prompt
 * is not here to want them. `q` hands the screen back to the shell.
 */
export class Blog implements Screen {
  readonly el: HTMLElement
  readonly quitLabel = 'shell'
  private body: HTMLElement
  private status: HTMLElement
  private titleEl: HTMLElement
  private quitBtn: HTMLButtonElement
  private opts: BlogOptions
  private list: ListView | null = null
  private view: BlogView
  private dirty = true

  constructor(host: HTMLElement, opts: BlogOptions, initial: BlogView) {
    this.opts = opts
    this.view = initial
    const parts = buildScreen('blog')
    this.el = parts.el
    this.body = parts.body
    this.status = parts.status
    this.titleEl = parts.title
    this.quitBtn = parts.el.querySelector('.screen-quit')!
    this.quitBtn.textContent = `q · ${this.quitLabel}`
    this.quitBtn.setAttribute('aria-label', 'quit to the shell')
    // A phone has no arrow keys, so the app carries its own. This is the whole
    // reading experience without ever opening a keyboard.
    const strip = document.createElement('div')
    strip.className = 'screen-strip'
    strip.setAttribute('role', 'toolbar')
    strip.setAttribute('aria-label', 'browse posts')
    strip.innerHTML =
      `<button type="button" class="screen-key" data-act="prev" aria-label="previous post">↑</button>` +
      `<button type="button" class="screen-key" data-act="next" aria-label="next post">↓</button>` +
      `<button type="button" class="screen-key" data-act="pageprev" aria-label="previous page">←</button>` +
      `<button type="button" class="screen-key" data-act="pagenext" aria-label="next page">→</button>` +
      `<button type="button" class="screen-key screen-key-open" data-act="open">⏎ read</button>` +
      `<button type="button" class="screen-key screen-key-quit" data-act="quit">q · shell</button>`
    this.el.appendChild(strip)
    strip.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')
      if (!btn) return
      e.preventDefault()
      switch (btn.dataset.act) {
        case 'prev': this.selectPrev(); break
        case 'next': this.selectNext(); break
        case 'pageprev': this.pagePrev(); break
        case 'pagenext': this.pageNext(); break
        case 'open': this.openSelected(); break
        case 'quit': this.opts.onQuit(); break
      }
    })

    host.appendChild(this.el)

    this.quitBtn.addEventListener('click', () => this.opts.onQuit())
    this.body.addEventListener('click', (e) => {
      const tok = (e.target as HTMLElement).closest<HTMLElement>('[data-cmd]')
      if (!tok) return
      e.preventDefault()
      // The terminal also listens for [data-cmd] on the document; without this
      // the token runs twice.
      e.stopPropagation()
      this.opts.onCommand(tok.dataset.cmd!)
    })
  }

  /**
   * Columns available for text, measured from the real cell width.
   *
   * The probe is a block child rather than the body itself: `clientWidth`
   * counts the body's padding, which on a phone reports about fifty columns
   * where there are forty-five, and the masthead then picks the wide build
   * and overflows.
   */
  private columns(): number {
    const probe = document.createElement('div')
    probe.style.cssText = 'visibility:hidden;height:0;overflow:hidden'
    probe.innerHTML = '<span style="white-space:pre">0000000000</span>'
    this.body.appendChild(probe)
    const inner = probe.getBoundingClientRect().width
    const cell = (probe.firstElementChild as HTMLElement).getBoundingClientRect().width / 10
    probe.remove()
    if (!(cell > 0) || !(inner > 0)) return 80
    return Math.max(20, Math.floor(inner / cell))
  }

  /**
   * The masthead: block letters when there is room, a plain box when there is
   * not. A phone is about forty cells wide; the block font needs forty-seven.
   */
  private masthead(cols: number, count: number): string[] {
    const footer = `${count} post${count === 1 ? '' : 's'}`
    if (cols >= bannerWidth(this.opts.title) + 6) {
      return boxed(renderBanner(this.opts.title), { padX: 2, footer })
    }
    const inner = Math.max(12, cols - 6)
    return boxed(
      [truncate(this.opts.title.toUpperCase(), inner), truncate(this.opts.description, inner)],
      { padX: 1, footer },
    )
  }

  show(view: BlogView): void {
    // Relaunching with no explicit page resumes where the reader left off;
    // quitting to the shell should not cost them their place in the archive.
    const sameSet = this.list !== null
      && view.label === this.view.label
      && view.docs.length === this.view.docs.length
      && view.docs[0]?.slug === this.view.docs[0]?.slug
    if (sameSet && view.page === undefined) return
    this.view = view
    // A hidden element measures zero, and the masthead picks its size from the
    // column count — so defer the draw to onEnter when we are not on screen yet.
    this.dirty = true
    if (!this.el.hidden) { this.render(); this.dirty = false }
  }

  /**
   * The page on screen. Falls back to the requested one because a ListView
   * reports its page from inside its own constructor, before the field it is
   * being assigned to exists.
   */
  get currentPage(): number { return this.list?.page ?? this.view.page ?? 1 }
  get selected(): number { return this.list?.selected ?? 0 }

  private render(): void {
    const { docs, label } = this.view
    const cols = this.columns()
    const wide = cols >= bannerWidth(this.opts.title) + 6

    this.titleEl.textContent = label === 'posts' ? this.opts.title : label

    this.body.replaceChildren()
    const head = document.createElement('div')
    head.className = 'blog-head'
    head.innerHTML =
      `<pre class="blog-art accent">${escapeHtml(this.masthead(cols, docs.length).join('\n'))}</pre>` +
      (wide ? `<div class="blog-tagline dim">${escapeHtml(truncate(this.opts.description, cols - 2))}</div>` : '') +
      `<div class="blog-tokens">` +
      ['about', 'links', 'help']
        .map((c) => `<button type="button" class="tok tok-cmd" data-cmd="${c}">${c}</button>`).join(' ') +
      `</div>`
    this.body.appendChild(head)

    // Drop the old one first, or the page number reported during the new
    // list's construction is the previous listing's.
    this.list = null
    this.list = new ListView(docs, {
      label,
      perPage: this.opts.perPage,
      page: this.view.page,
      onPage: (p) => { this.view = { ...this.view, page: p }; this.opts.onPage(p); this.updateStatus() },
      onOpen: (doc) => this.opts.onOpen(doc),
      onSelect: (doc) => this.opts.onSelect?.(doc),
    })
    this.body.appendChild(this.list.el)

    const credit = this.opts.credit
    if (credit?.show) {
      const el = document.createElement('div')
      el.className = 'blog-credit dim'
      el.innerHTML = credit.url
        ? `powered by <a href="${escapeHtml(credit.url)}" rel="noopener">ProseOS</a>`
        : 'powered by ProseOS'
      this.body.appendChild(el)
    }
    this.updateStatus()
  }

  onEnter(): void {
    if (this.dirty || !this.list) { this.render(); this.dirty = false }
    this.body.focus({ preventScroll: true })
    this.updateStatus()
  }

  private updateStatus(): void {
    if (!this.list) return
    const pages = this.list.pages
    const total = this.view.docs.length
    const pos = pages > 1
      ? `page ${this.list.page}/${pages}`
      : `${total} post${total === 1 ? '' : 's'}`
    this.status.innerHTML =
      `<span class="screen-pos">${escapeHtml(pos)}</span>` +
      `<span class="screen-keys">↑↓ select · ←→ page · ⏎ read</span>` +
      `<span class="screen-file">${escapeHtml(this.view.label)}</span>` +
      `<span class="screen-quit-hint">q · ${this.quitLabel}</span>`
  }

  // Exposed so the on-screen strip can drive the same actions as the keys.
  selectPrev(): void { this.list?.move(-1); this.updateStatus() }
  selectNext(): void { this.list?.move(1); this.updateStatus() }
  pagePrev(): void { this.list?.pageBy(-1); this.updateStatus() }
  pageNext(): void { this.list?.pageBy(1); this.updateStatus() }
  openSelected(): boolean { return this.list?.openCurrent() ?? false }

  onKey(e: KeyboardEvent): boolean {
    switch (e.key) {
      case 'ArrowUp': case 'k': this.selectPrev(); return true
      case 'ArrowDown': case 'j': this.selectNext(); return true
      case 'ArrowLeft': case 'h': this.pagePrev(); return true
      case 'ArrowRight': case 'l': this.pageNext(); return true
      case 'Enter': case 'o': this.openSelected(); return true
      case 'g': this.list?.setPage(1); this.updateStatus(); return true
      case 'G': this.list?.setPage(this.list.pages); this.updateStatus(); return true
      default: return false
    }
  }
}
