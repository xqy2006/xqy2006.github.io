import { escapeHtml } from '../core/terminal.js'
import { padEnd, width } from './width.js'

export interface Choice {
  /** What the reader picks. */
  label: string
  /** Passed back on confirm. */
  value: string
  /** Dim text after the label. */
  hint?: string
  /** Trusted markup after the hint — a colour swatch, say. */
  extra?: string
}

export interface ChoiceOptions {
  choices: Choice[]
  selected?: number
  /** Called as the selection moves, for a live preview. */
  onPreview?: (choice: Choice) => void
  onConfirm: (choice: Choice) => void
  /** Escape, or another command running. */
  onCancel?: () => void
}

const esc = escapeHtml

/**
 * A list you choose from, in the transcript.
 *
 * Both ways in are supported on purpose: arrow keys with Enter, and the
 * pointer. Clicking a row you have not selected selects it; clicking the one
 * already selected confirms it. That keeps a click from committing to
 * something the reader was only pointing at, and it means the row selected by
 * default still opens on a single click.
 */
export class ChoiceList {
  readonly el: HTMLElement
  /** Set by the shell: the prompt is hidden until this fires. */
  onSettle?: () => void
  private choices: Choice[]
  private opts: ChoiceOptions
  private index: number
  private done = false

  constructor(opts: ChoiceOptions) {
    this.opts = opts
    this.choices = opts.choices
    this.index = Math.min(Math.max(opts.selected ?? 0, 0), Math.max(0, this.choices.length - 1))
    this.el = document.createElement('div')
    this.el.className = 'cl'
    this.bind()
    this.render()
  }

  get current(): Choice | null { return this.choices[this.index] ?? null }
  get settled(): boolean { return this.done }

  move(delta: number): void {
    if (this.done || !this.choices.length) return
    const n = this.choices.length
    this.index = ((this.index + delta) % n + n) % n
    this.render()
    this.el.querySelector('.cl-row.is-selected')?.scrollIntoView({ block: 'nearest' })
    const choice = this.current
    if (choice) this.opts.onPreview?.(choice)
  }

  confirm(): void {
    const choice = this.current
    if (this.done || !choice) return
    this.done = true
    this.render()
    // The prompt comes back first: what is confirmed may open a screen over
    // the shell, and the shell underneath should already be finished.
    this.onSettle?.()
    this.opts.onConfirm(choice)
  }

  /** Escape, or another command taking over. */
  cancel(): void {
    if (this.done) return
    this.done = true
    this.render()
    this.onSettle?.()
    this.opts.onCancel?.()
  }

  private bind(): void {
    this.el.addEventListener('click', (e) => {
      if (this.done) return
      if ((e.target as HTMLElement).closest('.cl-cancel')) {
        e.preventDefault()
        e.stopPropagation()
        this.cancel()
        return
      }
      const row = (e.target as HTMLElement).closest<HTMLElement>('.cl-row')
      if (!row) return
      e.preventDefault()
      e.stopPropagation()
      const at = Number(row.dataset.index)
      if (at === this.index) { this.confirm(); return }
      this.index = at
      this.render()
      const choice = this.current
      if (choice) this.opts.onPreview?.(choice)
    })
  }

  private render(): void {
    if (!this.choices.length) {
      this.el.innerHTML = `<div class="dim">nothing to choose from</div>`
      return
    }
    const w = Math.max(...this.choices.map((c) => width(c.label)))
    const rows = this.choices.map((c, i) => {
      const on = i === this.index
      return `<button type="button" class="cl-row${on ? ' is-selected' : ''}" data-index="${i}"` +
        ` aria-current="${on ? 'true' : 'false'}"${this.done ? ' disabled' : ''}>` +
        `<span class="cl-mark" aria-hidden="true">${on ? '›' : ' '}</span>` +
        `<span class="cl-label">${esc(padEnd(c.label, w))}</span>` +
        (c.hint ? `<span class="cl-hint">${esc(c.hint)}</span>` : '') +
        (c.extra ?? '') +
        `</button>`
    }).join('')
    const foot = this.done
      ? `<div class="cl-foot dim">${esc(this.current?.label ?? '')}</div>`
      : `<div class="cl-foot dim">` +
        `<span class="cl-keys">↑↓ choose · ⏎ apply · esc cancel</span>` +
        `<span class="cl-taps">tap to try · tap again to keep</span>` +
        `<button type="button" class="cl-cancel">cancel</button></div>`
    this.el.innerHTML = `<div class="cl-rows">${rows}</div>${foot}`
  }
}
