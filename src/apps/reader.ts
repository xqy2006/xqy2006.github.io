import type { Doc, DocBody } from '../types.js'
import { escapeHtml } from '../core/terminal.js'
import { buildScreen, type Screen } from '../core/screens.js'

export interface ReaderHooks {
  /** After the body is in the DOM: upgrade media, wire internal links. */
  onRender: (body: HTMLElement, doc: Doc) => void
  onOpen: (doc: Doc) => void
  /** `q`: pop one level, back to the listing underneath. */
  onQuit: () => void
  onClose: () => void
}

/**
 * One post, full screen, the way `less` shows a file. It sits above the blog
 * in the stack, so `q` returns to the listing rather than to the shell.
 */
export class Reader implements Screen {
  readonly el: HTMLElement
  readonly quitLabel = 'back'
  private body: HTMLElement
  private status: HTMLElement
  private titleEl: HTMLElement
  private quitBtn: HTMLButtonElement
  private doc: Doc | null = null
  private hooks: ReaderHooks

  constructor(host: HTMLElement, hooks: ReaderHooks) {
    this.hooks = hooks
    const parts = buildScreen('reader')
    this.el = parts.el
    this.body = parts.body
    this.status = parts.status
    this.titleEl = parts.title
    this.quitBtn = parts.el.querySelector('.screen-quit')!
    this.quitBtn.textContent = `q · ${this.quitLabel}`
    this.quitBtn.setAttribute('aria-label', 'close the reader')
    host.appendChild(this.el)

    this.quitBtn.addEventListener('click', () => this.hooks.onQuit())
    this.body.addEventListener('scroll', () => this.updateStatus())
  }

  get current(): Doc | null { return this.doc }

  /**
   * Show a document. `body` may be null while its chunk is still loading: the
   * header is known from the listing, so the screen opens complete except for
   * the prose, and `fill` drops that in when it lands.
   */
  load(doc: Doc, body: DocBody | null): void {
    this.doc = doc
    this.titleEl.textContent = doc.title
    this.el.lang = doc.lang
    this.body.innerHTML =
      `<article class="md" data-slug="${escapeHtml(doc.slug)}">` +
      `<div class="md-meta">${escapeHtml(doc.date || '')}` +
      (doc.tags.length
        ? ` · ${doc.tags.map((t) => `<button type="button" class="md-tag" data-cmd="blog --tag ${escapeHtml(t)}">${escapeHtml(t)}</button>`).join(' ')}`
        : '') +
      ` · ${doc.minutes} min · ${doc.words} words</div>` +
      (body ? body.html : '<p class="dim">…</p>') + '</article>'
    this.body.scrollTop = 0
    if (body) this.hooks.onRender(this.body, doc)
    this.hooks.onOpen(doc)
    this.updateStatus()
  }

  /** The prose arrived. Ignored if the reader has moved on to another document. */
  fill(doc: Doc, body: DocBody): void {
    if (this.doc !== doc) return
    this.load(doc, body)
  }

  onEnter(): void {
    this.body.focus({ preventScroll: true })
    this.updateStatus()
  }

  onLeave(): void {
    this.hooks.onClose()
  }

  private updateStatus(): void {
    if (!this.doc) return
    const max = this.body.scrollHeight - this.body.clientHeight
    const pct = max <= 1 ? 100 : Math.round((this.body.scrollTop / max) * 100)
    this.status.innerHTML =
      `<span class="screen-pos">${pct === 100 ? 'END' : String(pct).padStart(2, ' ') + '%'}</span>` +
      `<span class="screen-keys">j/k scroll · g/G top/bottom</span>` +
      `<span class="screen-file">${escapeHtml(this.doc.path)}</span>` +
      `<span class="screen-quit-hint">q · ${this.quitLabel}</span>`
  }

  private by(delta: number): void {
    this.body.scrollBy({ top: delta, behavior: 'auto' })
  }

  onKey(e: KeyboardEvent): boolean {
    const line = 28
    switch (e.key) {
      case 'j': case 'ArrowDown': this.by(line); return true
      case 'k': case 'ArrowUp': this.by(-line); return true
      case 'd': this.by(this.body.clientHeight / 2); return true
      case 'u': this.by(-this.body.clientHeight / 2); return true
      case ' ': case 'PageDown': this.by(this.body.clientHeight * 0.9); return true
      case 'b': case 'PageUp': this.by(-this.body.clientHeight * 0.9); return true
      case 'g': this.body.scrollTo({ top: 0 }); return true
      case 'G': this.body.scrollTo({ top: this.body.scrollHeight }); return true
      default: return false
    }
  }
}
