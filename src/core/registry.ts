import type { ParsedLine } from './tokenizer.js'
import type { Vfs } from './vfs.js'
import type { FileStore } from './filestore.js'
import type { Settings } from './settings.js'
import type { Theme } from './theme.js'
import type { SiteConfig } from '../../site.config.js'
import type { Doc, Manifest, DocBody } from '../types.js'
import type { ChoiceOptions } from '../render/choices.js'

export interface Ctx {
  vfs: Vfs
  /** The writable tree, mounted at the home directory. */
  files: FileStore
  /** Resolve a path across both trees; `store` says which one owns it. */
  resolve(path: string): { store: boolean; path: string }
  /** Change directory in whichever tree owns the target. */
  chdir(path: string): { ok: true } | { ok: false; error: string }
  /** Open the editor on a writable path. */
  edit(path: string): void
  /** Open the Python prompt on an interpreter that is already loaded. */
  repl(py: unknown): void
  site: SiteConfig
  content: Manifest
  settings: Settings
  theme: Theme
  registry: Registry
  /** Columns available in the output area, measured from the real cell width. */
  columns(): number
  /** Lines from the previous pipeline stage, or null when nothing is piped in. */
  readonly stdin: string[] | null
  /**
   * True when this command's output feeds another command. Anything that would
   * take over the screen prints text instead, so `blog | wc -l` works.
   */
  readonly piped: boolean
  /** Append a plain-text block. Text is escaped. */
  print(text?: string, cls?: string): void
  /** Append trusted HTML produced by our own renderer. */
  printHtml(html: string, cls?: string): void
  /**
   * Print a chooser and hand it the arrow keys until it is answered.
   * Arrows and Enter drive it; a pointer selects first and confirms on a
   * second click of the same row.
   */
  choose(opts: ChoiceOptions): void
  /**
   * A status notice — "loading python", "nothing tagged design", "saved".
   * Always goes to the shell and never into a pipe: `blog --tag zzz | wc -l`
   * must be 0, not 1 because a sentence about there being nothing was
   * counted as a line.
   */
  note(text: string): void
  /**
   * A document's prose, fetched on demand. The listing ships with the page;
   * the prose is one chunk per document, so asking for it may wait a moment.
   */
  body(slug: string): Promise<DocBody | null>
  /** Every document's plain text, keyed by slug. One chunk, loaded on first search. */
  text(): Promise<Record<string, string>>
  error(message: string): void
  clear(): void
  /** Run another command, as if typed. */
  exec(line: string): Promise<void>
  /** Open a post in the reader, over the blog. */
  page(slug: string): boolean
  /**
   * Launch the blog application over the shell. Collections belong here rather
   * than in the transcript: a listing printed at the prompt crowds the
   * workspace the reader came back to the shell for.
   */
  blog(view?: { docs?: Doc[]; label?: string; page?: number }): void
  /** `persist: false` previews without remembering the choice. */
  setTheme(name: string, persist?: boolean): void
  applySettings(patch: Partial<Settings>): void
  focusInput(): void
}

export interface Command {
  name: string
  aliases?: string[]
  /** One line, shown by `help`. */
  description: string
  usage?: string
  /** Long form, shown by `man`. Markdown-ish plain text. */
  details?: string
  /**
   * Short flags of this command that take the next token as their value,
   * e.g. `['n']` for `head -n 5`. Long flags are handled globally.
   */
  valued?: string[]
  hidden?: boolean
  /** Completions for the argument currently being typed. */
  complete?: (ctx: Ctx, partial: string, index: number) => string[]
  run: (ctx: Ctx, line: ParsedLine) => void | Promise<void>
}

export class Registry {
  private map = new Map<string, Command>()
  private alias = new Map<string, string>()

  add(cmd: Command): this {
    this.map.set(cmd.name, cmd)
    for (const a of cmd.aliases ?? []) this.alias.set(a, cmd.name)
    return this
  }

  get(name: string): Command | undefined {
    const key = name.toLowerCase()
    return this.map.get(key) ?? this.map.get(this.alias.get(key) ?? '')
  }

  has(name: string): boolean { return !!this.get(name) }

  /** Sorted, excluding hidden ones. `help` and `man` read this. */
  all(): Command[] {
    return [...this.map.values()].filter((c) => !c.hidden).sort((a, b) => a.name.localeCompare(b.name))
  }

  /** Visible names and aliases, for completion. Hidden commands are excluded. */
  names(): string[] {
    const visible = [...this.map.values()].filter((c) => !c.hidden)
    return [...visible.map((c) => c.name), ...visible.flatMap((c) => c.aliases ?? [])].sort()
  }
}

/** Declare a command. Author extensions in src/commands/user/ use this. */
export const defineCommand = (cmd: Command): Command => cmd
