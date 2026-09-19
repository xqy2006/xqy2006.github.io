import { buildScreen, type Screen } from '../core/screens.js'
import { escapeHtml } from '../core/terminal.js'

export interface ReplHooks {
  /** Run a statement and hand back what it printed. */
  exec: (code: string) => Promise<{ lines: string[]; error?: string }>
  quit: () => void
}

/**
 * A Python prompt, as its own screen.
 *
 * This is the one application where `q` must not be the way out — it is a
 * perfectly good Python identifier — so it quits on Ctrl+D or `exit()`, and
 * the status line says so instead of the usual `q ·` hint.
 */
export class Repl implements Screen {
  readonly el: HTMLElement
  readonly quitLabel = 'shell'
  private log: HTMLElement
  private input: HTMLInputElement
  private promptEl: HTMLElement
  private status: HTMLElement
  private hooks: ReplHooks
  private history: string[] = []
  private historyIndex = -1
  /** Lines of an unfinished block, e.g. after `for x in y:`. */
  private buffer: string[] = []
  private busy = false

  constructor(host: HTMLElement, hooks: ReplHooks) {
    this.hooks = hooks
    const parts = buildScreen('repl')
    this.el = parts.el
    this.status = parts.status
    parts.title.textContent = 'python'

    parts.body.innerHTML =
      `<div class="repl-log" role="log" aria-live="polite"></div>` +
      `<div class="repl-line"><span class="repl-prompt">&gt;&gt;&gt;</span>` +
      `<input class="repl-input" type="text" autocomplete="off" autocapitalize="none"` +
      ` autocorrect="off" spellcheck="false" enterkeyhint="send" aria-label="python input"></div>`
    this.log = parts.body.querySelector('.repl-log')!
    this.input = parts.body.querySelector('.repl-input')!
    this.promptEl = parts.body.querySelector('.repl-prompt')!

    const quitBtn = parts.el.querySelector<HTMLButtonElement>('.screen-quit')!
    quitBtn.textContent = '^D · quit'
    quitBtn.addEventListener('click', () => this.hooks.quit())

    parts.body.addEventListener('pointerup', (e) => {
      if ((e.target as HTMLElement).closest('button, a')) return
      if (window.getSelection()?.toString()) return
      this.input.focus({ preventScroll: true })
    })

    this.input.addEventListener('keydown', (e) => {
      if (e.isComposing) return
      if (e.ctrlKey && e.key.toLowerCase() === 'd') { e.preventDefault(); this.hooks.quit(); return }
      if (e.key === 'Enter') { e.preventDefault(); void this.submit(); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); this.recall(-1); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); this.recall(1); return }
    })
    host.appendChild(this.el)
  }

  start(version: string): void {
    if (!this.log.childElementCount) {
      this.write(`Python (Pyodide ${version}) — Ctrl+D or exit() to leave`, 'dim')
      this.write('')
    }
    this.render()
  }

  onEnter(): void {
    this.input.focus({ preventScroll: true })
    this.render()
  }

  private write(text: string, cls = ''): void {
    const div = document.createElement('div')
    div.className = `repl-out${cls ? ' ' + cls : ''}`
    div.textContent = text
    this.log.appendChild(div)
    this.log.scrollTop = this.log.scrollHeight
  }

  private echo(prompt: string, text: string): void {
    const div = document.createElement('div')
    div.className = 'repl-out'
    div.innerHTML = `<span class="repl-prompt">${prompt}</span> ${escapeHtml(text)}`
    this.log.appendChild(div)
    this.log.scrollTop = this.log.scrollHeight
  }

  private recall(delta: number): void {
    if (!this.history.length) return
    if (this.historyIndex === -1) this.historyIndex = this.history.length
    const next = this.historyIndex + delta
    if (next >= this.history.length) { this.historyIndex = -1; this.input.value = ''; return }
    this.historyIndex = Math.max(0, next)
    this.input.value = this.history[this.historyIndex]
  }

  /** A block continues while the last line opens one or is indented. */
  private continues(line: string): boolean {
    return /:\s*$/.test(line) || (this.buffer.length > 0 && line.trim() !== '')
  }

  private async submit(): Promise<void> {
    if (this.busy) return
    const line = this.input.value
    this.input.value = ''
    this.echo(this.buffer.length ? '...' : '>>>', line)
    if (line.trim()) { this.history.push(line); this.historyIndex = -1 }

    if (/^\s*(exit|quit)\s*\(\s*\)\s*$/.test(line)) { this.hooks.quit(); return }

    if (this.continues(line)) {
      this.buffer.push(line)
      this.render()
      return
    }

    const code = this.buffer.length ? [...this.buffer, line].join('\n') : line
    this.buffer = []
    if (!code.trim()) { this.render(); return }

    this.busy = true
    this.render()
    try {
      const result = await this.hooks.exec(code)
      for (const l of result.lines) this.write(l)
      if (result.error) this.write(result.error, 'is-error')
    } finally {
      this.busy = false
      this.render()
      this.input.focus({ preventScroll: true })
    }
  }

  private render(): void {
    this.promptEl.textContent = this.buffer.length ? '...' : '>>>'
    this.input.disabled = this.busy
    this.status.innerHTML =
      `<span class="screen-pos">${this.busy ? 'running' : 'ready'}</span>` +
      `<span class="screen-keys">↑↓ history · blank line ends a block</span>` +
      `<span class="screen-file"></span>` +
      `<span class="screen-quit-hint">^D · ${this.quitLabel}</span>`
  }
}
