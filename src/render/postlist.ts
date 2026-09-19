import type { Doc } from '../types.js'
import { escapeHtml } from '../core/terminal.js'

export interface ListOptions {
  /** Shown in the footer, e.g. "posts" or "tagged design". */
  label?: string
  perPage: number
  /** Absolute index to select on mount; -1 for none. */
  selected?: number
  page?: number
  onOpen: (doc: Doc) => void
  /** Called when the visible page changes, for deep linking. */
  onPage?: (page: number) => void
  /** Called when the highlight lands on a post, before anyone opens it. */
  onSelect?: (doc: Doc) => void
}

const esc = escapeHtml

/**
 * A paginated, selectable list of posts that repaints in place.
 *
 * Paging rewrites this one element rather than appending a new block, so
 * walking through an archive leaves no trail in the transcript — which is the
 * whole point: after a dozen commands the post list should still be one thing
 * in one place, not twelve copies of itself.
 */
export class ListView {
  readonly el: HTMLElement
  readonly docs: Doc[]
  readonly perPage: number
  private label: string
  private onOpen: (doc: Doc) => void
  private onPage?: (page: number) => void
  private onSelect?: (doc: Doc) => void
  private lastPage = 0
  /**
   * Starts at whatever is selected on mount, so the first paint prefetches
   * nothing: a reader who has not moved has not chosen, and a listing that
   * downloads a post on arrival is the thing this split exists to stop.
   */
  private lastSelected: number
  /** Absolute index into `docs`, or -1 when nothing is selected. */
  selected: number
  private active = true

  constructor(docs: Doc[], opts: ListOptions) {
    this.docs = docs
    this.perPage = Math.max(1, opts.perPage)
    this.label = opts.label ?? 'posts'
    this.onOpen = opts.onOpen
    this.onPage = opts.onPage
    this.onSelect = opts.onSelect
    this.selected = opts.selected ?? (docs.length ? 0 : -1)
    if (opts.page !== undefined && opts.selected === undefined) {
      this.selected = Math.min(docs.length - 1, Math.max(0, (opts.page - 1) * this.perPage))
    }
    this.lastSelected = this.selected
    this.el = document.createElement('div')
    this.el.className = 'pl'
    this.bind()
    this.render()
  }

  get pages(): number { return Math.max(1, Math.ceil(this.docs.length / this.perPage)) }

  /** 1-based page holding the selection (or page 1 when nothing is selected). */
  get page(): number {
    if (this.selected < 0) return 1
    return Math.floor(this.selected / this.perPage) + 1
  }

  current(): Doc | null {
    return this.selected >= 0 ? this.docs[this.selected] ?? null : null
  }

  /** Open the selected post, if there is one. Returns whether it did. */
  openCurrent(): boolean {
    const doc = this.current()
    if (!doc) return false
    this.onOpen(doc)
    return true
  }

  /** Move the selection by `delta` rows, wrapping at the ends of the whole list. */
  move(delta: number): void {
    if (!this.docs.length) return
    const n = this.docs.length
    const from = this.selected < 0 ? (delta > 0 ? -1 : 0) : this.selected
    this.selected = ((from + delta) % n + n) % n
    this.render()
    this.scrollSelectionIntoView()
  }

  /** Change page, landing on the first row going forward and the last going back. */
  pageBy(delta: number): void {
    if (!this.docs.length) return
    const next = this.page + delta
    if (next < 1 || next > this.pages) return
    const first = (next - 1) * this.perPage
    const last = Math.min(this.docs.length, next * this.perPage) - 1
    this.selected = delta > 0 ? first : last
    this.render()
    this.scrollIntoView()
  }

  setPage(page: number): boolean {
    if (page < 1 || page > this.pages) return false
    this.selected = (page - 1) * this.perPage
    this.render()
    return true
  }

  /** A newer list has taken over the arrow keys; drop the highlight. */
  deactivate(): void {
    if (!this.active) return
    this.active = false
    this.el.classList.add('is-stale')
    this.render()
  }

  private scrollIntoView() {
    this.el.scrollIntoView({ block: 'nearest' })
  }

  private scrollSelectionIntoView() {
    this.el.querySelector('.pl-row.is-selected')?.scrollIntoView({ block: 'nearest' })
  }

  private bind() {
    this.el.addEventListener('click', (e) => {
      const nav = (e.target as HTMLElement).closest<HTMLElement>('[data-page]')
      if (nav) {
        e.preventDefault()
        this.pageBy(nav.dataset.page === 'next' ? 1 : -1)
        return
      }
      const row = (e.target as HTMLElement).closest<HTMLElement>('.pl-row')
      if (!row) return
      e.preventDefault()
      // The same rule the chooser uses: a click on a row you have not selected
      // selects it, a click on the selected row opens it. With a mouse that is
      // still one click, because moving onto the row selected it already.
      const at = Number(row.dataset.index)
      if (at === this.selected) { this.openCurrent(); return }
      this.selected = at
      this.render()
    })

    // Pointer and keyboard must agree on what Enter would open.
    this.el.addEventListener('pointerover', (e) => {
      if (!this.active) return
      const row = (e.target as HTMLElement).closest<HTMLElement>('.pl-row')
      if (!row || row.classList.contains('is-selected')) return
      this.selected = Number(row.dataset.index)
      this.render()
    })
  }

  render(): void {
    if (this.page !== this.lastPage) {
      this.lastPage = this.page
      this.onPage?.(this.page)
    }
    // Whatever is highlighted is what Enter will open, so this is the moment
    // to go and get it.
    if (this.selected !== this.lastSelected) {
      this.lastSelected = this.selected
      const doc = this.current()
      if (doc) this.onSelect?.(doc)
    }
    const start = (this.page - 1) * this.perPage
    const slice = this.docs.slice(start, start + this.perPage)

    if (!this.docs.length) {
      this.el.innerHTML = `<div class="pl-empty dim">no posts</div>`
      return
    }

    const rows = slice.map((d, i) => {
      const index = start + i
      const on = this.active && index === this.selected
      return `<button type="button" class="pl-row${on ? ' is-selected' : ''}" data-index="${index}"` +
        ` aria-current="${on ? 'true' : 'false'}">` +
        `<span class="pl-mark" aria-hidden="true">${on ? '›' : ' '}</span>` +
        `<span class="pl-date">${esc(d.date)}</span>` +
        `<span class="pl-title">${esc(d.title)}</span>` +
        `<span class="pl-meta">${esc(d.tags.slice(0, 2).join(' '))}</span>` +
        `</button>`
    }).join('')

    const first = start + 1
    const last = start + slice.length
    const pos = `${first}–${last} of ${this.docs.length} ${esc(this.label)}`
    const prevOff = this.page <= 1
    const nextOff = this.page >= this.pages
    const nav = this.pages > 1
      ? `<span class="pl-nav">` +
        `<button type="button" class="pl-page" data-page="prev"${prevOff ? ' disabled' : ''}>← prev</button>` +
        `<span class="pl-count">${this.page}/${this.pages}</span>` +
        `<button type="button" class="pl-page" data-page="next"${nextOff ? ' disabled' : ''}>next →</button>` +
        `</span>`
      : ''

    this.el.innerHTML =
      `<div class="pl-rows">${rows}</div>` +
      `<div class="pl-foot"><span class="pl-pos dim">${pos}</span>${nav}</div>`
  }
}
