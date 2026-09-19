import { buildScreen, type Screen } from '../core/screens.js'
import { escapeHtml } from '../core/terminal.js'

export interface EditorHooks {
  save: (path: string, text: string) => { ok: true } | { ok: false; error: string }
  quit: () => void
}

/**
 * `nano`, more or less: a textarea with a status line and two bindings.
 *
 * Deliberately not an IDE — no syntax highlighting, no run key. You edit a
 * file, you save it, you quit, and then you run it from the shell. Adding a
 * run key here would quietly turn a blog into an editor with a blog attached.
 */
export class Editor implements Screen {
  readonly el: HTMLElement
  readonly quitLabel = 'shell'
  private area: HTMLTextAreaElement
  private status: HTMLElement
  private titleEl: HTMLElement
  private hooks: EditorHooks
  private path = ''
  private saved = ''
  /** nano's habit: the first ^Q on a dirty buffer warns, the second discards. */
  private armedToDiscard = false
  private note: { text: string; kind: 'ok' | 'error' } | null = null

  constructor(host: HTMLElement, hooks: EditorHooks) {
    this.hooks = hooks
    const parts = buildScreen('editor')
    this.el = parts.el
    this.status = parts.status
    this.titleEl = parts.title

    this.area = document.createElement('textarea')
    this.area.className = 'ed-area'
    this.area.spellcheck = false
    this.area.autocapitalize = 'none'
    this.area.setAttribute('autocorrect', 'off')
    this.area.setAttribute('aria-label', 'file contents')
    parts.body.appendChild(this.area)

    const quitBtn = parts.el.querySelector<HTMLButtonElement>('.screen-quit')!
    quitBtn.textContent = '^Q · quit'
    quitBtn.addEventListener('click', () => this.tryQuit())

    this.area.addEventListener('input', () => { this.armedToDiscard = false; this.note = null; this.render() })
    this.area.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase()
      const held = e.ctrlKey || e.metaKey
      // Tab moves focus out of a textarea by default, which is useless in an
      // editor whose main job is Python.
      const act = held && key === 's' ? () => this.save()
        : held && key === 'q' ? () => this.tryQuit()
        : e.key === 'Escape' ? () => this.tryQuit()
        : e.key === 'Tab' ? () => this.indent(e.shiftKey)
        : null
      if (!act) return
      e.preventDefault()
      e.stopPropagation()
      act()
    })
    host.appendChild(this.el)
  }

  get dirty(): boolean { return this.area.value !== this.saved }
  get file(): string { return this.path }
  get text(): string { return this.area.value }

  load(path: string, text: string): void {
    this.path = path
    this.saved = text
    this.area.value = text
    this.armedToDiscard = false
    this.note = null
    this.titleEl.textContent = path
    this.render()
  }

  save(): boolean {
    const result = this.hooks.save(this.path, this.area.value)
    if (!result.ok) {
      this.note = { text: result.error, kind: 'error' }
      this.render()
      return false
    }
    this.saved = this.area.value
    this.armedToDiscard = false
    this.note = { text: 'saved', kind: 'ok' }
    this.render()
    return true
  }

  /** Quit, unless there is unsaved work and this is the first attempt. */
  tryQuit(): boolean {
    if (this.dirty && !this.armedToDiscard) {
      this.armedToDiscard = true
      this.note = { text: 'unsaved changes — ^Q again to discard', kind: 'error' }
      this.render()
      return false
    }
    this.hooks.quit()
    return true
  }

  /** Two spaces in, two spaces out, across whatever is selected. */
  private indent(outdent: boolean): void {
    const { selectionStart: from, selectionEnd: to, value } = this.area
    const startOfLine = value.lastIndexOf('\n', from - 1) + 1
    const endOfBlock = to === from ? from : (value.indexOf('\n', to - 1) + 1 || value.length)

    if (from === to && !outdent) {
      this.area.setRangeText('  ', from, to, 'end')
      this.area.dispatchEvent(new Event('input'))
      return
    }

    const block = value.slice(startOfLine, endOfBlock)
    const shifted = block.split('\n')
      .map((l) => (outdent ? l.replace(/^ {1,2}/, '') : (l === '' ? l : '  ' + l)))
      .join('\n')
    this.area.setRangeText(shifted, startOfLine, endOfBlock, 'select')
    this.area.dispatchEvent(new Event('input'))
  }

  onEnter(): void {
    this.area.focus({ preventScroll: true })
    this.render()
  }

  private render(): void {
    const lines = this.area.value === '' ? 0 : this.area.value.split('\n').length
    const note = this.note
      ? `<span class="${this.note.kind === 'error' ? 'is-error' : 'accent'}">${escapeHtml(this.note.text)}</span>`
      : ''
    this.status.innerHTML =
      `<span class="screen-pos">${lines} ${lines === 1 ? 'line' : 'lines'}${this.dirty ? ' *' : ''}</span>` +
      `<span class="screen-keys">^S save · ^Q quit</span>` +
      `<span class="screen-file">${note}</span>` +
      `<span class="screen-quit-hint">^Q · ${this.quitLabel}</span>`
  }
}
