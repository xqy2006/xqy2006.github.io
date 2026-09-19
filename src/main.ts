import manifest from 'virtual:proseos/content'
import { loadBody, loadText, peekBody, seedBody, warmBody } from './content/bodies.js'
import site from '../site.config.js'
import { Vfs } from './core/vfs.js'
import { Terminal, escapeHtml } from './core/terminal.js'
import { ScreenStack } from './core/screens.js'
import { Reader } from './apps/reader.js'
import { Blog } from './apps/blog.js'
import { Editor } from './apps/editor.js'
import { Repl } from './apps/repl.js'
import { FileStore, createIdbAdapter } from './core/filestore.js'
import { execute, pythonVersion, type PyodideApi } from './runtime/python.js'
import { createRegistry } from './commands/index.js'
import { setHistoryProvider, setHistoryClearer } from './commands/builtin.js'
import { parsePipeline, splitPipeline, parseTokens } from './core/tokenizer.js'
import * as themeKit from './core/theme.js'
import * as settingsKit from './core/settings.js'
import { upgradeMedia, recolorAll, type MediaHost } from './render/media.js'
import { plain } from './render/width.js'
import { expandHistory, expandAliasStages } from './core/expand.js'
import { ChoiceList, type ChoiceOptions } from './render/choices.js'
import type { Ctx } from './core/registry.js'
import type { Doc } from './types.js'

import './styles/index.css'

document.documentElement.classList.add('js')

const root = document.getElementById('app')!
const prerender = document.getElementById('prerender')

const vfs = new Vfs(manifest)
const files = new FileStore(createIdbAdapter(), `/home/${site.user}`)
const registry = createRegistry()
const restored = settingsKit.load()
let settings = restored.settings
// The OS dark-mode preference only picks a default; it never overrules a
// theme the reader chose explicitly on a previous visit.
let theme = themeKit.apply(restored.stored ? settings.theme : themeKit.preferred(settings.theme))
settings = { ...settings, theme: theme.name }

// Vite's own base, not site.config's, so a build-time override (the Pages
// workflow passes the repository name) reaches the router as well as the
// asset URLs.
const base = import.meta.env.BASE_URL.replace(/\/$/, '')
const prompt = () => `${site.user}@${site.host}:${vfs.cwd}$`

const terminal = new Terminal({
  root,
  registry,
  prompt,
  // A screen owns the keyboard while it runs; the prompt is not under it.
  canFocus: () => !screens.isOpen,
  moreNames: () => Object.keys(settingsKit.loadAliases()),
  preprocess: (line) => {
    const expanded = expandHistory(line, terminal.getHistory())
    if (expanded.missing) {
      // A history reference that resolves to nothing is not a command; say so
      // and abandon the line rather than running the literal text.
      terminal.error(`${expanded.missing}: event not found`)
      return null
    }
    // History records what was typed. Aliases are expanded later, per stage,
    // so `↑` gives back the alias rather than the command behind it.
    return expanded.line
  },
  onLine: (line) => runPipeline(line),
})

const mediaHost: MediaHost = { settings, theme }

const screens = new ScreenStack(() => {
  syncUrl()
  // Quitting the last screen hands the keyboard back, so take the prompt.
  // Not on touch: that would raise the soft keyboard uninvited.
  if (!screens.isOpen && !terminal.coarse) terminal.focusInput()
})

const reader = new Reader(document.body, {
  onRender: (body, doc) => {
    decorate(body)
    upgradeMedia(body, mediaHost)
    document.title = `${doc.title} · ${site.title}`
  },
  onOpen: () => {},
  onQuit: () => { screens.pop() },
  onClose: () => {},
})

const editor = new Editor(document.body, {
  save: (path, text) => files.write(path, text),
  quit: () => screens.pop(),
})

const repl = new Repl(document.body, {
  exec: async (code) => {
    const result = await execute(pyRuntime!, files, code)
    const notes: string[] = [...result.failed]
    if (result.changed.length) notes.push(`wrote ${result.changed.join(', ')}`)
    if (result.removed.length) notes.push(`removed ${result.removed.join(', ')}`)
    return { lines: [...result.lines, ...notes], error: result.error }
  },
  quit: () => screens.pop(),
})

/** Set once Python has been loaded; the REPL is only opened after that. */
let pyRuntime: PyodideApi | null = null

const blog = new Blog(document.body, {
  title: site.title,
  description: site.description,
  perPage: site.postsPerPage,
  onOpen: (doc) => openDoc(doc.slug),
  onSelect: (doc) => warmBody(doc.slug),
  onPage: () => syncUrl(),
  onQuit: () => screens.clear(),
  onCommand: (line) => {
    // A token naming a document opens it here; anything else runs in the
    // shell, which reveals itself if and when the command prints.
    const doc = vfs.resolveDoc(line.trim())
    if (doc) { openDoc(doc.slug); return }
    void terminal.run(line)
  },
}, { docs: manifest.posts, label: 'posts' })

/** Launch (or re-target) the blog application. */
function openBlog(view: { docs?: Doc[]; label?: string; page?: number } = {}): void {
  blog.show({
    docs: view.docs ?? manifest.posts,
    label: view.label ?? 'posts',
    page: view.page,
  })
  if (screens.has(blog)) screens.popTo(blog)
  else { screens.clear(); screens.push(blog) }
}

/**
 * Open a post. The blog stays underneath, so `q` returns to the listing.
 *
 * The screen goes up now and the prose follows: the header is in the listing
 * we already have, so waiting on the chunk would only delay an empty frame.
 */
function openDoc(slug: string): boolean {
  const doc = vfs.resolveDoc(slug)
  if (!doc) return false
  if (!screens.has(blog)) openBlog()
  const have = peekBody(doc.slug)
  reader.load(doc, have)
  screens.push(reader)
  if (!have) void loadBody(doc.slug).then((body) => { if (body) reader.fill(doc, body) })
  return true
}

/**
 * Only the reader has a URL of its own. The blog and the shell both live at
 * `/`, which keeps `q` from stacking history entries nobody asked for.
 */
/**
 * Where the build wrote this document, and every other address it answers to.
 *
 * A document imported from another site keeps the URL it was indexed under,
 * and the address this site would have given it becomes an alias. Both are
 * real pages; only `doc.url` is canonical, and only it is ever written to the
 * address bar.
 */
const docUrl = (doc: Doc): string => `${base}${doc.url}`

const byUrl = new Map<string, Doc>()
for (const doc of [...manifest.posts, ...manifest.pages]) {
  for (const u of [doc.url, ...doc.aliases]) byUrl.set(u, doc)
}

function syncUrl(): void {
  const top = screens.top
  const target = top === reader && reader.current
    ? docUrl(reader.current)
    : `${base}/${blog.currentPage > 1 ? `?page=${blog.currentPage}` : ''}`
  // The title tracks what is on screen even when the address already matches —
  // pressing Back moves the URL first, so an early return would leave the tab
  // still naming the post you just left.
  document.title = top === reader && reader.current
    ? `${reader.current.title} · ${site.title}`
    : site.title

  const here = location.pathname + location.search
  if (here === target) return
  if (top === reader) history.pushState({ slug: reader.current?.slug }, '', target)
  else history.replaceState({ page: blog.currentPage }, '', target)
}

/**
 * Pipeline state. `sink` collects a stage's output when another stage is going
 * to read it; when it is null, output goes to the terminal as usual.
 */
let sink: string[] | null = null
let stdinLines: string[] | null = null
let pipedStage = false

/**
 * Run a line, which may be several commands joined by pipes.
 *
 * Text is the only thing a pipe carries: a stage's `print` lands in the sink,
 * and `printHtml` lands there as its plain text. A stage that would take over
 * the screen prints instead, which is what makes `blog | wc -l` mean
 * something.
 */
const valuedFor = (name: string) => registry.get(name)?.valued

async function runPipeline(line: string): Promise<void> {
  const stages = expandAliasStages(splitPipeline(line), settingsKit.loadAliases())
    .map((tokens) => parseTokens(tokens, line, valuedFor(tokens[0] ?? '')))
  if (!stages.length) return

  if (stages.some((st) => !st.name)) {
    ctx.error("syntax error near unexpected token `|'")
    return
  }
  for (const st of stages) {
    if (registry.has(st.name)) continue
    ctx.error(`${st.name}: command not found. try \`help\`.`)
    const near = registry.names().filter((n) => st.name.length > 1 && n.startsWith(st.name.slice(0, 2)))
    if (near.length) {
      ctx.printHtml(`<span class="dim">did you mean</span> ` +
        near.slice(0, 4).map((n) => `<button type="button" class="tok tok-cmd" data-cmd="${n}">${n}</button>`).join(' '))
    }
    return
  }

  let carried: string[] | null = null
  for (let i = 0; i < stages.length; i++) {
    const last = i === stages.length - 1
    sink = last ? null : []
    stdinLines = carried
    pipedStage = !last
    try {
      await registry.get(stages[i].name)!.run(ctx, stages[i])
    } finally {
      carried = sink
      sink = null
      stdinLines = null
      pipedStage = false
    }
  }
}

/**
 * Reveal the shell, because something is about to be written to it.
 *
 * This is deliberately *not* done when a command starts: clearing the stack up
 * front would mean `blog --tag x`, tapped from inside a post, could no longer
 * see that the blog was already open — and it would re-push it from scratch
 * instead of re-targeting the one that is there.
 */
function toShell(): void {
  if (screens.isOpen) screens.clear()
}

/** Wire internal links and copy buttons in freshly inserted content. */
function decorate(scope: ParentNode) {
  scope.querySelectorAll<HTMLAnchorElement>('a.md-link[data-internal]').forEach((a) => {
    if (a.dataset.wired) return
    a.dataset.wired = '1'
    a.addEventListener('click', (e) => {
      const href = a.getAttribute('href') || ''
      const slug = href.replace(/^.*\/posts\//, '').replace(/\/$/, '').replace(/\.md$/, '')
      const doc = vfs.resolveDoc(slug)
      if (!doc) return // let the browser handle it
      e.preventDefault()
      openDoc(doc.slug)
    })
  })
  scope.querySelectorAll<HTMLButtonElement>('button[data-copy]').forEach((b) => {
    if (b.dataset.wired) return
    b.dataset.wired = '1'
    b.addEventListener('click', async () => {
      const code = b.closest('.md-code')?.querySelector('code')?.textContent ?? ''
      try {
        await navigator.clipboard.writeText(code)
        b.textContent = 'copied'
      } catch {
        b.textContent = 'failed'
      }
      setTimeout(() => { b.textContent = 'copy' }, 1200)
    })
  })
}

const ctx: Ctx = {
  vfs,
  site,
  content: manifest,
  get settings() { return settings },
  get theme() { return theme },
  registry,
  columns: () => terminal.columns(),
  get stdin() { return stdinLines },
  get piped() { return pipedStage },
  print: (text = '', cls) => {
    if (sink) { sink.push(...String(text).split('\n')); return }
    toShell()
    terminal.print(text, cls)
  },
  printHtml: (html, cls) => {
    if (sink) { sink.push(...plain(html).split('\n').filter((l) => l.length)); return }
    toShell()
    terminal.printHtml(html, cls)
    const last = terminal.output.lastElementChild
    if (last) { decorate(last); upgradeMedia(last, mediaHost) }
  },
  choose: (opts: ChoiceOptions) => {
    toShell()
    const list = new ChoiceList(opts)
    terminal.printNode(list.el, 'term-choice')
    terminal.setActiveChoice(list)
  },
  note: (text) => { toShell(); terminal.print(text, 'dim') },
  body: (slug) => loadBody(slug),
  text: () => loadText(),
  error: (m) => { toShell(); terminal.error(m) },
  clear: () => { toShell(); terminal.clear() },
  exec: async (line) => {
    // Delegation (grep → find, help → man) must run *inside* the current
    // stage: starting a fresh top-level run would echo a second prompt and
    // drop whatever pipe this command was writing into.
    const stages = parsePipeline(line, valuedFor)
    if (stages.length === 1 && registry.has(stages[0].name)) {
      await registry.get(stages[0].name)!.run(ctx, stages[0])
      return
    }
    await runPipeline(line)
  },
  page: (slug) => openDoc(slug),
  files,
  resolve: (path) => {
    // `~` and anything under the home directory belong to the writable tree;
    // everything else is the read-only projection of the content manifest.
    const expanded = path.startsWith('~') ? files.normalize(path) : path
    const abs = expanded.startsWith('/') ? expanded : vfs.normalize(expanded)
    return files.owns(abs) ? { store: true, path: files.normalize(abs) } : { store: false, path: abs }
  },
  chdir: (path) => {
    const target = ctx.resolve(path)
    if (!target.store) return vfs.chdir(target.path)
    const known = target.path === files.root || files.list(target.path).length > 0
    if (!known) return { ok: false, error: `no such file or directory: ${path}` }
    vfs.cwd = target.path
    return { ok: true }
  },
  edit: (path) => {
    editor.load(path, files.read(path) ?? '')
    screens.push(editor)
  },
  repl: (py) => {
    pyRuntime = py as PyodideApi
    repl.start(pythonVersion())
    screens.push(repl)
  },
  blog: (view = {}) => {
    if (pipedStage) {
      for (const d of view.docs ?? manifest.posts) ctx.print(`${d.date}  ${d.slug}  ${d.title}  ${d.tags.join(" ")}`)
      return
    }
    openBlog(view)
  },
  setTheme: (name, persist = true) => {
    theme = themeKit.apply(name)
    mediaHost.theme = theme
    settings = { ...settings, theme: name }
    mediaHost.settings = settings
    if (persist) settingsKit.save(settings)
    recolorAll(document, mediaHost)
  },
  applySettings: (patch) => {
    settings = { ...settings, ...patch }
    mediaHost.settings = settings
    settingsKit.save(settings)
    document.documentElement.dataset.ligatures = settings.ligatures ? 'on' : 'off'
    upgradeMedia(document, mediaHost)
  },
  focusInput: () => terminal.focusInput(),
}

terminal.ctx = ctx
setHistoryProvider(() => terminal.getHistory())
setHistoryClearer(() => terminal.clearHistory())
document.documentElement.dataset.ligatures = settings.ligatures ? 'on' : 'off'

// ---- boot ------------------------------------------------------------------

terminal.setChips([
  { label: 'blog', run: 'blog' },
  { label: 'tags', run: 'tags' },
  { label: 'theme', run: 'theme' },
  { label: 'help', run: 'help' },
  { label: 'clear', run: 'clear' },
])

const pageFromUrl = (): number | undefined => {
  const n = Number(new URLSearchParams(location.search).get('page'))
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : undefined
}

/** Reflect a URL into the screen stack: a document's URL opens it over the blog. */
function routeFromLocation(from = location.pathname + location.search): void {
  const path = from.split('?')[0].replace(base, '') || '/'
  // Matched exactly, against the addresses the build actually wrote. A fuzzy
  // slug lookup made /posts/ open an article whose slug contained "posts".
  const doc = byUrl.get(decodeURIComponent(path).replace(/\/*$/, '/'))
  if (doc) openDoc(doc.slug)
  else if (screens.has(reader)) screens.popTo(blog)
}

window.addEventListener('popstate', () => routeFromLocation())

// The prose for the document this page was built for is already in the DOM.
// Fetching the chunk that says the same thing would download it twice.
const prerendered = prerender?.querySelector<HTMLElement>('article.md[data-slug]')
if (prerendered) {
  seedBody(prerendered.dataset.slug!, {
    html: prerendered.innerHTML,
    toc: [...prerendered.querySelectorAll<HTMLElement>('.md-h')].map((h) => ({
      depth: Number(h.tagName[1]),
      id: h.id,
      text: h.querySelector('.md-h-text')?.textContent ?? '',
    })),
  })
}
prerender?.remove()

/**
 * The masthead lays itself out in cells, so it has to be measured with the
 * real font: rendering before the webfont swaps in measures the fallback,
 * overestimates the column count, and the listing wraps on a phone.
 */
async function boot(): Promise<void> {
  // Load the writable tree before anything else can be typed: a read that
  // lands before it resolves sees an empty file and would save that over the
  // real one.
  await files.load()
  try { await document.fonts?.ready } catch { /* no font loading API */ }

  // What you land on when you quit the blog. A bare prompt reads as a broken
  // page; this is what a motd is for.
  terminal.printHtml(
    `<span class="accent">${escapeHtml(site.title)}</span> <span class="dim">— ${escapeHtml(site.description)}</span>`,
    'term-greeting')
  terminal.printHtml(
    `<span class="dim">type </span><button type="button" class="tok tok-cmd" data-cmd="blog">blog</button>` +
    `<span class="dim"> to browse, </span><button type="button" class="tok tok-cmd" data-cmd="help">help</button>` +
    `<span class="dim"> for everything else.</span>`,
    'term-greeting')
  terminal.print('')

  // Read the address before opening anything: pushing the blog rewrites the
  // URL, which would erase the post we were asked for.
  const landing = location.pathname + location.search
  openBlog({ page: pageFromUrl() })
  routeFromLocation(landing)
  if (!terminal.coarse) terminal.focusInput()
}
void boot()

if (import.meta.env.DEV) {
  console.info(`[proseos] ${manifest.posts.length} posts, ${registry.all().length} commands`)
}
