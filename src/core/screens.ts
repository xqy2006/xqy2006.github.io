/**
 * Full-screen applications, the way a terminal has them.
 *
 * `less`, `man` and `htop` take the whole screen, own the keyboard while they
 * run, and hand it back on `q` with the shell's scrollback untouched. That is
 * the model here: the blog is a program the shell launches, not a mode the
 * prompt is in. It is also why there is no hidden mode left — inside a screen
 * there is no prompt, and at the prompt there is no screen.
 */
export interface Screen {
  readonly el: HTMLElement
  /** Where `q` goes from here — shown in the status bar's last slot. */
  readonly quitLabel: string
  /** Becoming the top of the stack. */
  onEnter?(): void
  /** No longer the top: something opened over it, or it was popped. */
  onLeave?(): void
  /** Return true when the key was consumed. */
  onKey?(e: KeyboardEvent): boolean
}

export class ScreenStack {
  private stack: Screen[] = []
  private onChange: () => void

  constructor(onChange: () => void = () => {}) {
    this.onChange = onChange
    document.addEventListener('keydown', this.handleKey, true)
  }

  get top(): Screen | null { return this.stack[this.stack.length - 1] ?? null }
  get depth(): number { return this.stack.length }
  get isOpen(): boolean { return this.stack.length > 0 }
  has(screen: Screen): boolean { return this.stack.includes(screen) }

  push(screen: Screen): void {
    if (this.top === screen) {
      // Already on top, but its contents just changed — following a link from
      // one post to another reloads the reader in place. Still sync, or the
      // address bar and the title keep describing what you were reading.
      this.sync()
      return
    }
    this.top?.onLeave?.()
    this.stack.push(screen)
    this.sync()
    screen.onEnter?.()
  }

  /** `q`: down one level. Returns the screen that was left. */
  pop(): Screen | null {
    const leaving = this.stack.pop() ?? null
    if (leaving) {
      leaving.onLeave?.()
      // sync() only walks the stack, so a screen that has just left it would
      // otherwise stay on top of the page with nothing driving it.
      leaving.el.hidden = true
    }
    this.sync()
    this.top?.onEnter?.()
    return leaving
  }

  /** Unwind to the shell. */
  clear(): void {
    while (this.stack.length) {
      const leaving = this.stack.pop()!
      leaving.onLeave?.()
      leaving.el.hidden = true
    }
    this.sync()
  }

  /** Unwind until `screen` is on top; does nothing if it is not in the stack. */
  popTo(screen: Screen): void {
    if (!this.has(screen)) return
    while (this.top && this.top !== screen) this.pop()
  }

  private sync(): void {
    const top = this.top
    for (const s of this.stack) s.el.hidden = s !== top
    document.documentElement.classList.toggle('is-screen', this.isOpen)
    this.onChange()
  }

  private handleKey = (e: KeyboardEvent): void => {
    const screen = this.top
    if (!screen) return
    const target = e.target as HTMLElement | null
    // A screen may host its own input; never steal from one.
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
    if (e.ctrlKey || e.metaKey || e.altKey) return
    // Enter and Space belong to whatever control has focus. Consuming them
    // means tabbing to `next →` and pressing Enter opens a post instead.
    if ((e.key === 'Enter' || e.key === ' ') && target?.closest('button, a, select')) return

    if (screen.onKey?.(e)) {
      e.preventDefault()
      e.stopPropagation()
      return
    }
    if (e.key === 'q' || e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      this.pop()
    }
  }
}

/** Shared chrome: a title bar, a body, and a status line ending in `q · <where>`. */
export function buildScreen(kind: string): {
  el: HTMLElement
  bar: HTMLElement
  title: HTMLElement
  body: HTMLElement
  status: HTMLElement
} {
  const el = document.createElement('div')
  el.className = `screen screen-${kind}`
  el.hidden = true
  el.setAttribute('role', 'region')
  el.innerHTML = `
    <div class="screen-bar">
      <span class="screen-title"></span>
      <button class="screen-quit" type="button"></button>
    </div>
    <div class="screen-body" tabindex="-1"></div>
    <div class="screen-status"></div>`
  return {
    el,
    bar: el.querySelector('.screen-bar')!,
    title: el.querySelector('.screen-title')!,
    body: el.querySelector('.screen-body')!,
    status: el.querySelector('.screen-status')!,
  }
}
