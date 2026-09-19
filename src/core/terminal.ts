import { parseLine } from './tokenizer.js'
import type { ChoiceList } from '../render/choices.js'
import type { Registry, Ctx } from './registry.js'

const HISTORY_KEY = 'proseos:history'
const HISTORY_MAX = 200

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface TerminalOptions {
  root: HTMLElement
  registry: Registry
  prompt: () => string
  /** Called for every submitted line, after it is echoed. */
  onLine: (line: string) => Promise<void>
  /**
   * Returns false while a full-screen application owns the keyboard. Without this the `finally` in run() steals focus back from the
   * reader the moment `open` returns, and j/k/q go to the prompt instead.
   */
  canFocus?: () => boolean
  /**
   * Rewrites a line before it is echoed or run.
   *
   * Resolves `!!` and friends. Returning null abandons the line, as a shell
   * does when a history reference resolves to nothing. Aliases are expanded
   * further down, per pipeline stage, so history keeps what was typed.
   */
  preprocess?: (line: string) => string | null
  /** Extra names for Tab completion — aliases, which the registry never sees. */
  moreNames?: () => string[]
}

export class Terminal {
  readonly root: HTMLElement
  readonly output: HTMLElement
  readonly form: HTMLElement
  readonly input: HTMLInputElement
  private mirror: HTMLElement
  private promptEl: HTMLElement
  private chips: HTMLElement
  private keys: HTMLElement
  /** Touch device: the soft keyboard costs half the screen, so never open it uninvited. */
  readonly coarse: boolean = typeof matchMedia === 'function'
    && matchMedia('(pointer: coarse)').matches
  private registry: Registry
  private promptFn: () => string
  private onLine: (line: string) => Promise<void>
  private canFocus: () => boolean
  private preprocess: (line: string) => string | null
  private moreNames: () => string[]
  /** Ctrl+R state: the query and where in history the current match sits. */
  private search: { query: string; index: number } | null = null
  private searchDraft = ''
  private history: string[] = []
  private historyIndex = -1
  private draft = ''
  private busy = false
  private pinned = true
  private cellWidth = 8
  private completionState: { prefix: string; matches: string[]; index: number } | null = null
  private refocusAfterRun = false
  /**
   * A chooser printed into the transcript and still waiting for an answer.
   * It borrows the arrow keys and Enter while the prompt is empty.
   */
  private activeChoice: ChoiceList | null = null

  constructor(opts: TerminalOptions) {
    this.root = opts.root
    this.registry = opts.registry
    this.promptFn = opts.prompt
    this.onLine = opts.onLine
    this.canFocus = opts.canFocus ?? (() => true)
    this.preprocess = opts.preprocess ?? ((l) => l)
    this.moreNames = opts.moreNames ?? (() => [])

    this.root.innerHTML = `
      <div class="term-scroll" tabindex="-1">
        <div class="term-output" role="log" aria-live="polite" aria-label="terminal output"></div>
        <div class="term-form">
          <label class="term-prompt" for="term-input"></label>
          <div class="term-field">
            <div class="term-mirror" aria-hidden="true"></div>
            <input id="term-input" class="term-input" type="text" autocomplete="off"
                   autocapitalize="none" autocorrect="off" spellcheck="false"
                   inputmode="text" enterkeyhint="go" aria-label="command input">
          </div>
        </div>
      </div>
      <div class="term-bar">
        <div class="term-chips" role="toolbar" aria-label="quick commands"></div>
        <div class="term-keys" role="toolbar" aria-label="editing keys" hidden>
          <button type="button" class="term-key" data-key="prev" aria-label="previous command">↑</button>
          <button type="button" class="term-key" data-key="next" aria-label="next command">↓</button>
          <button type="button" class="term-key" data-key="complete" aria-label="complete">⇥ tab</button>
          <button type="button" class="term-key" data-key="word" aria-label="delete word">⌫ word</button>
          <button type="button" class="term-key" data-key="clear" aria-label="clear line">clear</button>
          <button type="button" class="term-key term-key-done" data-key="done">done</button>
        </div>
      </div>`

    this.output = this.root.querySelector('.term-output')!
    this.form = this.root.querySelector('.term-form')!
    this.input = this.root.querySelector('.term-input')!
    this.mirror = this.root.querySelector('.term-mirror')!
    this.promptEl = this.root.querySelector('.term-prompt')!
    this.chips = this.root.querySelector('.term-chips')!
    this.keys = this.root.querySelector('.term-keys')!

    this.loadHistory()
    this.bind()
    this.refreshPrompt()
    this.measureCell()
  }

  // ---- layout ------------------------------------------------------------

  private get scroller(): HTMLElement {
    return this.root.querySelector('.term-scroll')!
  }

  private measureCell() {
    const probe = document.createElement('span')
    probe.textContent = '0'.repeat(10)
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre'
    this.output.appendChild(probe)
    const w = probe.getBoundingClientRect().width / 10
    probe.remove()
    if (w > 0) this.cellWidth = w
  }

  /** Usable width in cells. Commands use this to lay out columns. */
  columns(): number {
    this.measureCell()
    const w = this.output.clientWidth || this.root.clientWidth
    return Math.max(20, Math.floor(w / this.cellWidth))
  }

  // ---- output ------------------------------------------------------------

  private append(el: HTMLElement) {
    this.output.appendChild(el)
    if (this.pinned) this.scrollToEnd()
  }

  print(text = '', cls = ''): void {
    const div = document.createElement('div')
    div.className = `term-line${cls ? ' ' + cls : ''}`
    div.textContent = text
    this.append(div)
  }

  /** Append a live element (a listing that repaints itself, for instance). */
  printNode(el: HTMLElement, cls = ''): void {
    const wrap = document.createElement('div')
    wrap.className = `term-block${cls ? ' ' + cls : ''}`
    wrap.appendChild(el)
    this.append(wrap)
  }

  printHtml(html: string, cls = ''): void {
    const div = document.createElement('div')
    div.className = `term-block${cls ? ' ' + cls : ''}`
    div.innerHTML = html
    this.append(div)
  }

  error(message: string): void {
    this.print(message, 'is-error')
  }

  echo(line: string): void {
    const div = document.createElement('div')
    div.className = 'term-line term-echo'
    div.innerHTML =
      `<span class="term-prompt-echo">${escapeHtml(this.promptFn())}</span> ` +
      `<span class="term-echo-text">${escapeHtml(line)}</span>`
    this.append(div)
  }

  clear(): void {
    this.output.replaceChildren()
  }

  scrollToEnd(): void {
    const s = this.scroller
    s.scrollTop = s.scrollHeight
  }

  // ---- prompt / input ----------------------------------------------------

  refreshPrompt(): void {
    this.promptEl.textContent = this.search
      ? `(reverse-i-search)'${this.search.query}':`
      : this.promptFn()
    this.promptEl.classList.toggle('is-search', !!this.search)
    this.renderMirror()
  }

  // ---- reverse history search (Ctrl+R) -----------------------------------

  private startSearch(): void {
    // Its own draft: ↑ may already be holding one, and restoring the wrong
    // one on Escape is worse than not restoring at all.
    this.searchDraft = this.input.value
    this.historyIndex = -1
    this.search = { query: '', index: this.history.length }
    this.matchFrom(this.history.length - 1)
  }

  /** Walk backwards from `from` for the newest line containing the query. */
  private matchFrom(from: number): void {
    if (!this.search) return
    const q = this.search.query.toLowerCase()
    for (let i = Math.min(from, this.history.length - 1); i >= 0; i--) {
      if (!q || this.history[i].toLowerCase().includes(q)) {
        this.search.index = i
        this.setValue(this.history[i])
        this.refreshPrompt()
        return
      }
    }
    // Nothing older matches; keep what is on the line and say so by leaving
    // the query visible in the prompt.
    this.refreshPrompt()
  }

  private endSearch(restoreDraft: boolean): void {
    if (!this.search) return
    this.search = null
    if (restoreDraft) this.setValue(this.searchDraft)
    this.refreshPrompt()
  }

  private searchKey(e: KeyboardEvent): boolean {
    if (!this.search) return false
    if (e.key === 'Enter') { this.endSearch(false); return false }
    if (e.key === 'Escape') { e.preventDefault(); this.endSearch(true); return true }
    if (e.ctrlKey && e.key.toLowerCase() === 'r') { e.preventDefault(); this.matchFrom(this.search.index - 1); return true }
    if (e.ctrlKey && e.key.toLowerCase() === 'g') { e.preventDefault(); this.endSearch(true); return true }
    if (e.key === 'Backspace') {
      e.preventDefault()
      this.search.query = this.search.query.slice(0, -1)
      this.matchFrom(this.history.length - 1)
      return true
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      this.search.query += e.key
      this.matchFrom(this.history.length - 1)
      return true
    }
    // Any other key leaves the search but keeps the line it found.
    this.endSearch(false)
    return false
  }

  /** Draw the value with a block cursor; the real input is transparent. */
  private renderMirror(): void {
    const v = this.input.value
    const pos = this.input.selectionStart ?? v.length
    const before = v.slice(0, pos)
    const at = v.slice(pos, pos + 1)
    const after = v.slice(pos + 1)
    const focused = document.activeElement === this.input
    this.mirror.innerHTML =
      escapeHtml(before) +
      `<span class="term-cursor${focused ? '' : ' is-blurred'}">${at ? escapeHtml(at) : ' '}</span>` +
      escapeHtml(after)
  }

  setBusy(busy: boolean): void {
    this.busy = busy
    this.form.classList.toggle('is-busy', busy)
    this.root.classList.toggle('is-busy', busy)
    this.input.disabled = busy
    // Returning focus re-opens the soft keyboard. Only do it if the reader was
    // already typing: tapping a chip on a phone should not summon it.
    if (!busy && (!this.coarse || this.refocusAfterRun)) this.focusInput()
  }

  focusInput(): void {
    if (this.busy || this.choosing || !this.canFocus()) return
    this.input.focus({ preventScroll: true })
    this.renderMirror()
  }

  setValue(v: string): void {
    // Any completion cycle was computed for the line being replaced.
    this.completionState = null
    this.input.value = v
    this.input.setSelectionRange(v.length, v.length)
    this.renderMirror()
  }

  /**
   * Hand the keyboard to a chooser until it is answered.
   *
   * The prompt goes away while it waits. A command that ends by asking a
   * question has not ended, and printing the next `$` under the question says
   * it has — so the shell holds the line the way `read` does.
   */
  setActiveChoice(choice: ChoiceList | null): void {
    this.activeChoice?.cancel() // hands the prompt back through onSettle
    this.activeChoice = choice
    if (!choice) return
    choice.onSettle = () => { if (this.activeChoice === choice) { this.activeChoice = null; this.showPrompt() } }
    this.form.classList.add('is-choosing')
    this.input.blur()
  }

  private showPrompt(): void {
    this.form.classList.remove('is-choosing')
    this.refreshPrompt()
    this.scrollToEnd()
    if (!this.coarse || this.refocusAfterRun) this.focusInput()
  }

  private get choosing(): boolean {
    return !!this.activeChoice && !this.activeChoice.settled
  }

  /** Editing actions a soft keyboard cannot reach. Used by the key strip. */
  historyPrev(): void { this.stepHistory(-1) }
  historyNext(): void { this.stepHistory(1) }
  completeNow(): void { this.complete(false) }
  killWord(): void { this.setValue(this.input.value.replace(/\s*\S+\s*$/, '')) }
  dismiss(): void { this.input.blur() }

  // ---- chips (mobile discoverability) ------------------------------------

  setChips(items: { label: string; run: string }[]): void {
    this.chips.replaceChildren()
    for (const it of items) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'term-chip'
      b.textContent = it.label
      b.dataset.cmd = it.run
      this.chips.appendChild(b)
    }
  }

  // ---- history -----------------------------------------------------------

  private loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY)
      if (raw) this.history = (JSON.parse(raw) as string[]).slice(-HISTORY_MAX)
    } catch { this.history = [] }
  }

  private saveHistory() {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history.slice(-HISTORY_MAX))) } catch { /* ignore */ }
  }

  getHistory(): readonly string[] { return this.history }

  clearHistory(): void {
    this.history = []
    this.historyIndex = -1
    this.saveHistory()
  }

  private pushHistory(line: string) {
    if (line && this.history[this.history.length - 1] !== line) {
      this.history.push(line)
      if (this.history.length > HISTORY_MAX) this.history.shift()
      this.saveHistory()
    }
    this.historyIndex = -1
    this.draft = ''
  }

  private stepHistory(delta: number) {
    if (!this.history.length) return
    if (this.historyIndex === -1) {
      if (delta > 0) return
      this.draft = this.input.value
      this.historyIndex = this.history.length
    }
    const next = this.historyIndex + delta
    if (next >= this.history.length) {
      this.historyIndex = -1
      this.setValue(this.draft)
      return
    }
    this.historyIndex = Math.max(0, next)
    this.setValue(this.history[this.historyIndex])
  }

  // ---- completion --------------------------------------------------------

  private completions(): string[] {
    const value = this.input.value
    const upToCursor = value.slice(0, this.input.selectionStart ?? value.length)
    // Complete within the current pipeline stage: after a bar you are naming
    // a command again, not an argument of the one before it.
    const stage = upToCursor.slice(upToCursor.lastIndexOf('|') + 1).trimStart()
    const parts = stage === '' ? [''] : stage.split(/\s+/)
    const partial = parts[parts.length - 1] ?? ''
    if (parts.length <= 1) {
      return [...this.registry.names(), ...this.moreNames()]
        .filter((n) => n.startsWith(partial.toLowerCase()))
    }
    const cmd = this.registry.get(parts[0])
    if (!cmd?.complete) return []
    return cmd.complete(this.ctx!, partial, parts.length - 1).filter((c) => c.startsWith(partial))
  }

  /** Set by the app once the context exists; completion needs it. */
  ctx: Ctx | null = null

  /** Where the token under the cursor begins: after a space, or after a bar. */
  private partialStart(head: string): number {
    return Math.max(head.lastIndexOf(' '), head.lastIndexOf('|')) + 1
  }

  private applyCompletion(match: string) {
    const value = this.input.value
    const cursor = this.input.selectionStart ?? value.length
    const head = value.slice(0, cursor)
    const tail = value.slice(cursor)
    const start = this.partialStart(head)
    const next = head.slice(0, start) + match
    this.input.value = next + tail
    this.input.setSelectionRange(next.length, next.length)
    this.renderMirror()
  }

  private complete(shift: boolean) {
    if (this.completionState) {
      const s = this.completionState
      s.index = (s.index + (shift ? -1 : 1) + s.matches.length) % s.matches.length
      this.applyCompletion(s.matches[s.index])
      return
    }
    const matches = [...new Set(this.completions())]
    if (!matches.length) return
    if (matches.length === 1) {
      this.applyCompletion(matches[0] + ' ')
      return
    }
    const common = matches.reduce((a, b) => {
      let i = 0
      while (i < a.length && i < b.length && a[i] === b[i]) i++
      return a.slice(0, i)
    })
    const value = this.input.value
    const cursor = this.input.selectionStart ?? value.length
    const head = value.slice(0, cursor)
    const partial = head.slice(this.partialStart(head))
    if (common.length > partial.length) {
      this.applyCompletion(common)
      return
    }
    this.echo(this.input.value)
    this.printHtml(matches.map((m) => `<span class="term-completion">${escapeHtml(m)}</span>`).join(''), 'term-completions')
    this.completionState = { prefix: partial, matches, index: -1 }
  }

  // ---- events ------------------------------------------------------------

  private bind() {
    const sync = () => this.renderMirror()
    this.input.addEventListener('input', () => { this.completionState = null; sync() })
    this.input.addEventListener('keyup', sync)
    this.input.addEventListener('click', sync)
    this.input.addEventListener('focus', () => {
      this.root.classList.add('is-typing')
      if (this.coarse) { this.keys.hidden = false; this.chips.hidden = true }
      sync()
      // The keyboard is about to cover the bottom; keep the prompt visible.
      setTimeout(() => this.scrollToEnd(), 120)
    })
    this.input.addEventListener('blur', () => {
      this.root.classList.remove('is-typing')
      this.keys.hidden = true
      this.chips.hidden = false
      sync()
    })
    this.input.addEventListener('compositionupdate', sync)
    this.input.addEventListener('compositionend', sync)

    this.input.addEventListener('keydown', (e) => {
      if (e.isComposing) return // let the IME finish; Enter belongs to it
      if (this.search && this.searchKey(e)) return
      if (!this.search && e.ctrlKey && e.key.toLowerCase() === 'r') {
        e.preventDefault()
        this.startSearch()
        return
      }
      switch (e.key) {
        // This key belongs to the prompt. If the command it submits ends by
        // asking a question, the same keystroke must not also answer it on
        // its way up to the document.
        case 'Enter': e.preventDefault(); e.stopPropagation(); void this.submit(); return
        // The blog is a program, not a mode, so the arrows are the shell's:
        // history here, post selection in there.
        case 'ArrowUp': e.preventDefault(); this.stepHistory(-1); return
        case 'ArrowDown': e.preventDefault(); this.stepHistory(1); return
        case 'Tab': e.preventDefault(); this.complete(e.shiftKey); return
        case 'Escape': e.preventDefault(); this.dismiss(); return
      }
      if (e.key !== 'Tab') this.completionState = null

      // Ctrl+W is reserved by the browser (it closes the tab, and
      // preventDefault is ignored), so word-kill uses readline's other
      // binding instead.
      if (e.altKey && (e.key === 'Backspace' || e.key.toLowerCase() === 'w')) {
        e.preventDefault()
        this.setValue(this.input.value.replace(/\s*\S+\s*$/, ''))
        return
      }

      if (e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'l': e.preventDefault(); this.clear(); return
          case 'c': {
            if (window.getSelection()?.toString()) return // let copy work
            e.preventDefault()
            this.echo(this.input.value + ' ^C')
            this.setValue('')
            return
          }
          case 'u': e.preventDefault(); this.setValue(''); return
          case 'p': e.preventDefault(); this.stepHistory(-1); return
          case 'n': e.preventDefault(); this.stepHistory(1); return
          case 'a': e.preventDefault(); this.input.setSelectionRange(0, 0); sync(); return
          case 'e': {
            e.preventDefault()
            const n = this.input.value.length
            this.input.setSelectionRange(n, n)
            sync()
            return
          }
        }
      }
    })

    // Focus on tap, but never steal a selection the reader is making.
    // On a touch device only the prompt line opens the keyboard: tapping the
    // transcript is how you scroll and read, and it should stay that way.
    this.root.addEventListener('pointerup', (e) => {
      const t = e.target as HTMLElement
      if (t.closest('a, button, video, audio, input')) return
      if (window.getSelection()?.toString()) return
      if (this.coarse && !t.closest('.term-form')) return
      this.focusInput()
    })

    // A press anywhere on the key strip must not blur the input: losing focus
    // would close the soft keyboard the strip exists to supplement.
    this.keys.addEventListener('pointerdown', (e) => e.preventDefault())
    this.keys.addEventListener('mousedown', (e) => e.preventDefault())
    this.keys.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-key]')
      if (!btn) return
      e.preventDefault()
      switch (btn.dataset.key) {
        case 'prev': this.historyPrev(); break
        case 'next': this.historyNext(); break
        case 'complete': this.completeNow(); break
        case 'word': this.killWord(); break
        case 'clear': this.setValue(''); break
        case 'done': this.dismiss(); return
      }
      this.focusInput()
    })

    // Clickable output: anything with data-cmd runs that command. Bound to the
    // document because screens are mounted on <body>, outside this.root.
    document.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-cmd]')
      if (!el) return
      e.preventDefault()
      // The draft is not this command's to discard.
      void this.run(el.dataset.cmd!)
    })

    // A pending chooser has the keyboard, and the prompt it belongs to is
    // hidden, so these arrive on the document rather than on the input.
    document.addEventListener('keydown', (e) => {
      if (!this.choosing || e.isComposing) return
      // Ctrl+R belongs to the prompt, and the prompt is hidden. Taking it here
      // keeps it from reaching the browser, which would reload the page and
      // take the transcript with it.
      if (e.ctrlKey && e.key.toLowerCase() === 'r') {
        e.preventDefault()
        this.setActiveChoice(null)
        this.startSearch()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const choice = this.activeChoice!
      switch (e.key) {
        case 'ArrowUp': e.preventDefault(); choice.move(-1); return
        case 'ArrowDown': e.preventDefault(); choice.move(1); return
        case 'Enter': e.preventDefault(); choice.confirm(); return
        case 'Escape': e.preventDefault(); this.setActiveChoice(null); return
      }
      // Typing is how you say "never mind" without reaching for Escape: the
      // question goes away and the character starts the next command.
      if (e.key.length !== 1) return
      e.preventDefault()
      this.setActiveChoice(null)
      this.setValue(e.key)
    })

    const scroller = this.scroller
    scroller.addEventListener('scroll', () => {
      const gap = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
      this.pinned = gap < 24
    })

    window.addEventListener('resize', () => this.measureCell())

    // Size the app to the *visual* viewport. When a soft keyboard opens, iOS
    // leaves the layout viewport at full height, so `100dvh` alone puts the
    // prompt underneath the keyboard.
    //
    // This is the only mechanism: the layout viewport is locked (see the
    // `html.js` rule in base.css) so it cannot scroll to reveal the input,
    // which keeps visualViewport.offsetTop at 0. Compensating for offsetTop as
    // well would fight this one and push the key strip off-screen.
    const vv = window.visualViewport
    if (vv) {
      const fit = () => {
        this.root.style.setProperty('--vh', `${vv.height}px`)
        if (this.pinned) this.scrollToEnd()
      }
      fit()
      vv.addEventListener('resize', fit)
      vv.addEventListener('scroll', fit)
    }
  }

  private async submit() {
    const line = this.input.value
    this.setValue('')
    await this.run(line, true)
  }

  /** Echo, dispatch, and report failures as terminal errors rather than throwing. */
  async run(line: string, fromPrompt = false): Promise<void> {
    // A tappable token can be clicked while something slow is still running —
    // loading Python takes seconds. Two overlapping runs share the pipeline's
    // buffers, so the second one's output lands in the first one's pipe.
    // One at a time, and say so rather than swallowing the tap.
    if (this.busy) {
      this.print('still working — that one was ignored', 'dim')
      return
    }
    // A tapped token runs without going through the prompt; the search it
    // interrupted must not stay armed, eating everything typed next.
    this.endSearch(false)
    // A new command supersedes whatever was being chosen.
    this.setActiveChoice(null)
    // Expand before echoing: `!!` should show what it became, and history
    // should record that, not the shorthand.
    const expanded = this.preprocess(line)
    if (expanded === null) { this.scrollToEnd(); return }
    this.refocusAfterRun = document.activeElement === this.input
    this.pinned = true
    this.echo(expanded)
    if (fromPrompt) this.pushHistory(expanded.trim())
    const parsed = parseLine(expanded)
    if (!parsed.name) { this.scrollToEnd(); return }
    this.setBusy(true)
    try {
      await this.onLine(expanded)
    } catch (err) {
      this.error(`${parsed.name}: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      this.setBusy(false)
      this.refreshPrompt()
      this.scrollToEnd()
    }
  }
}
