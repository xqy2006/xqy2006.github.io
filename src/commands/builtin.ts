import { defineCommand, type Command, type Ctx } from '../core/registry.js'
import { escapeHtml } from '../core/terminal.js'
import { padEnd, width, truncate, BOX } from '../render/width.js'
import { themes, themeNames } from '../core/theme.js'
import type { Doc } from '../types.js'
import { listStore } from './files.js'

const esc = escapeHtml

/** A clickable output token that runs `cmd` when tapped. */
const action = (label: string, cmd: string, cls = '') =>
  `<button type="button" class="tok ${cls}" data-cmd="${esc(cmd)}">${esc(label)}</button>`

/** Lay items out in `ls`-style columns while keeping each one clickable. */
function columnsHtml(items: { label: string; cmd?: string; cls?: string }[], total: number): string {
  if (!items.length) return ''
  const cell = Math.max(...items.map((i) => width(i.label))) + 2
  const cols = Math.max(1, Math.floor(total / cell))
  const rows = Math.ceil(items.length / cols)
  const lines: string[] = []
  for (let r = 0; r < rows; r++) {
    let line = ''
    for (let c = 0; c < cols; c++) {
      const it = items[c * rows + r]
      if (!it) continue
      const pad = ' '.repeat(Math.max(0, cell - width(it.label)))
      const body = it.cmd ? action(it.label, it.cmd, it.cls ?? '') : `<span class="${it.cls ?? ''}">${esc(it.label)}</span>`
      line += c === cols - 1 ? body : body + pad
    }
    lines.push(line)
  }
  return lines.join('\n')
}

/**
 * Collections open the blog application; the shell's transcript stays clear
 * for the work the reader came back to the shell for.
 */
function listDocs(ctx: Ctx, docs: Doc[], label = 'posts', page?: number) {
  if (!docs.length) { ctx.note(label === 'posts' ? 'no posts yet' : `nothing ${label}`); return }
  ctx.blog({ docs, label, page })
}

// ---------------------------------------------------------------------------

const help = defineCommand({
  name: 'help',
  aliases: ['?', 'h'],
  description: 'list every available command',
  usage: 'help [command]',
  details: 'With no argument, prints the whole registry, including commands you have added yourself in src/commands/user/.',
  run(ctx, line) {
    if (line.args[0]) return ctx.exec(`man ${line.args[0]}`) as unknown as void
    const cmds = ctx.registry.all()
    const w = Math.max(...cmds.map((c) => width(c.name)))
    const room = ctx.columns() - w - 4
    const rows = cmds.map((c) =>
      `  ${action(c.name, c.name, 'tok-cmd')}${' '.repeat(w - width(c.name))}  ` +
      `<span class="dim">${esc(truncate(c.description, Math.max(10, room)))}</span>`).join('\n')
    ctx.printHtml(
      `<span class="accent">commands</span>  <span class="dim">(tap one, or type it · Tab completes · man &lt;cmd&gt; for detail)</span>\n${rows}`,
      'term-help')
  },
})

const man = defineCommand({
  name: 'man',
  description: 'show the manual page for a command',
  usage: 'man <command>',
  complete: (ctx) => ctx.registry.names(),
  run(ctx, line) {
    const name = line.args[0]
    if (!name) { ctx.error('man: what manual page do you want?'); return }
    const cmd = ctx.registry.get(name)
    if (!cmd) { ctx.error(`man: no entry for ${name}`); return }
    const out = [
      `<span class="accent">NAME</span>`,
      `    ${esc(cmd.name)} — ${esc(cmd.description)}`,
      '',
      `<span class="accent">SYNOPSIS</span>`,
      `    ${esc(cmd.usage ?? cmd.name)}`,
    ]
    if (cmd.aliases?.length) out.push('', `<span class="accent">ALIASES</span>`, `    ${esc(cmd.aliases.join(', '))}`)
    if (cmd.details) out.push('', `<span class="accent">DESCRIPTION</span>`, ...cmd.details.split('\n').map((l) => `    ${esc(l)}`))
    ctx.printHtml(out.join('\n'), 'term-man')
  },
})

const ls = defineCommand({
  name: 'ls',
  aliases: ['dir', 'll'],
  description: 'list posts, pages and directories',
  usage: 'ls [-l] [--tag <tag>] [path]',
  details: '-l gives one entry per line with dates and sizes.\n--tag filters posts by tag.\nEntries are clickable; tapping one opens it.',
  complete: (ctx, partial) =>
    [...ctx.vfs.paths(), ...ctx.vfs.docs().map((d) => d.slug)].filter((p) => p.startsWith(partial)),
  run(ctx, line) {
    const tag = typeof line.flags.tag === 'string' ? line.flags.tag : null
    if (tag) {
      const hits = ctx.content.posts.filter((p) => p.tags.includes(tag))
      listDocs(ctx, hits, `tagged ${tag}`, pageFlag(line))
      return
    }
    const target = line.args[0] ?? '.'
    const where = ctx.resolve(target)
    if (where.store) { listStore(ctx, where.path, line.flags.l === true || line.name === 'll'); return }
    const entries = ctx.vfs.list(target)
    if (!entries) { ctx.error(`ls: ${target}: no such file or directory`); return }
    if (line.flags.l || line.name === 'll') {
      const nameW = Math.max(...entries.map((e) => width(e.name)))
      const html = entries.map((e) => {
        const kind = e.kind === 'dir' ? 'd' : '-'
        const size = String(e.size ?? 0).padStart(6)
        const date = e.mtime || '        '
        const label = e.kind === 'dir' ? e.name + '/' : e.name
        const link = e.doc ? action(label, `open ${e.doc.slug}`, 'tok-doc')
          : action(label, `cd ${e.path}`, 'tok-dir')
        return `<span class="dim">${kind}r--r--r--</span> ${size} <span class="dim">${esc(date)}</span> ` +
          link + ' '.repeat(Math.max(0, nameW - width(label)))
      }).join('\n')
      ctx.printHtml(html, 'term-list')
      return
    }
    if (ctx.piped) {
      for (const e of entries) ctx.print(e.kind === 'dir' ? `${e.name}/` : e.name)
      return
    }
    ctx.printHtml(columnsHtml(entries.map((e) => ({
      label: e.kind === 'dir' ? e.name + '/' : e.name,
      cmd: e.doc ? `open ${e.doc.slug}` : `cd ${e.path}`,
      cls: e.kind === 'dir' ? 'tok-dir' : 'tok-doc',
    })), ctx.columns()), 'term-list')
  },
})

const cd = defineCommand({
  name: 'cd',
  description: 'change the current directory',
  usage: 'cd [path]',
  details: 'With no argument, goes home — `cd /` for the content tree.',
  complete: (ctx, partial) => [...ctx.vfs.paths(), ctx.files.root, '~/']
    .filter((p) => p.startsWith(partial)),
  run(ctx, line) {
    const res = ctx.chdir(line.args[0] || '~')
    if (!res.ok) ctx.error(`cd: ${res.error}`)
  },
})

const pwd = defineCommand({
  name: 'pwd',
  description: 'print the current directory',
  run(ctx) { ctx.print(ctx.vfs.cwd) },
})

const tree = defineCommand({
  name: 'tree',
  description: 'draw the content tree',
  usage: 'tree [path]',
  run(ctx, line) {
    const where = line.args[0] ?? '.'
    const start = ctx.vfs.get(where)
    if (!start) { ctx.error(`tree: ${where}: no such directory`); return }
    const out: string[] = [`<span class="tok-dir">${esc(start.path)}</span>`]
    const walk = (node: typeof start, prefix: string) => {
      const kids = [...(node.children?.values() ?? [])]
        .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1))
      kids.forEach((k, i) => {
        const last = i === kids.length - 1
        const branch = last ? `${BOX.bl}${BOX.h}${BOX.h} ` : `${BOX.teeRight}${BOX.h}${BOX.h} `
        const label = k.kind === 'dir' ? `<span class="tok-dir">${esc(k.name)}/</span>` : action(k.name, `open ${k.doc!.slug}`, 'tok-doc')
        out.push(`<span class="dim">${prefix}${branch}</span>${label}`)
        if (k.kind === 'dir') walk(k, prefix + (last ? '    ' : `${BOX.v}   `))
      })
    }
    walk(start, '')
    const files = ctx.vfs.docs().length
    out.push('', `<span class="dim">${files} documents</span>`)
    ctx.printHtml(out.join('\n'), 'term-tree')
  },
})

const cat = defineCommand({
  name: 'cat',
  description: 'print a document into the transcript',
  usage: 'cat <slug|path>',
  details: 'Streams the rendered document into this shell. `open` gives you the\nfull-screen reader instead, and `blog` the browser.',
  complete: (ctx, partial) => ctx.vfs.docs().map((d) => d.slug).filter((s) => s.startsWith(partial)),
  async run(ctx, line) {
    const ref = line.args[0]
    if (!ref) { ctx.error('cat: missing operand'); return }
    const where = ctx.resolve(ref)
    if (where.store) {
      const text = ctx.files.read(where.path)
      if (text !== null) { ctx.print(text); return }
      // Fall through: from ~ a bare slug resolves into the writable tree, but
      // it is still the name of a post.
    }
    const doc = ctx.vfs.resolveDoc(ref)
    if (!doc) { ctx.error(`cat: ${ref}: no such document`); return }
    const body = await ctx.body(doc.slug)
    if (!body) { ctx.error(`cat: ${ref}: no such document`); return }
    ctx.printHtml(`<article class="md" lang="${esc(doc.lang)}" data-slug="${esc(doc.slug)}">${body.html}</article>`, 'term-doc')
  },
})

const open = defineCommand({
  name: 'open',
  aliases: ['less', 'read', 'more', 'view'],
  description: 'open a document in the full-screen reader',
  usage: 'open <slug|path>',
  details: 'Takes over the screen the way less does.\nj/k scroll, space pages, g/G jump. q returns to the listing it was opened\nfrom, on the page and row you left.',
  complete: (ctx, partial) => ctx.vfs.docs().map((d) => d.slug).filter((s) => s.startsWith(partial)),
  run(ctx, line) {
    const ref = line.args[0]
    if (!ref) { ctx.error('open: missing operand'); return }
    const doc = ctx.vfs.resolveDoc(ref)
    if (!doc) { ctx.error(`open: ${ref}: no such document`); return }
    ctx.page(doc.slug)
  },
})

/** Shared by `find` and `grep`, so neither has to re-serialise a pattern. */
async function searchDocs(ctx: Ctx, query: string): Promise<void> {
  const needle = query.toLowerCase()
  const text = await ctx.text()
  const hits = ctx.vfs.docs().filter((d) => (d.title + '\n' + (text[d.slug] ?? '')).toLowerCase().includes(needle))
  if (!hits.length) { ctx.note(`no matches for "${query}"`); return }
  ctx.blog({ docs: hits, label: `matching "${query}"` })
}

const find = defineCommand({
  name: 'find',
  aliases: ['search', '/'],
  description: 'search every document for a phrase',
  usage: 'find <query>',
  async run(ctx, line) {
    const query = line.args.join(' ').trim()
    if (!query) { ctx.error('find: missing query'); return }
    await searchDocs(ctx, query)
  },
})

const grep = defineCommand({
  name: 'grep',
  description: 'filter piped lines, or search the posts',
  usage: 'grep [-v] <pattern>',
  details: [
    'With a pipe it filters lines: `blog | grep design`.',
    'Without one it searches every document, like `find`.',
    '-v keeps the lines that do not match.',
  ].join('\n'),
  async run(ctx, line) {
    const pattern = line.args.join(' ').trim()
    if (!pattern) { ctx.error('grep: missing pattern'); return }
    // Call the search directly rather than re-serialising the pattern into a
    // command line: a `|` in it would split into stages and could run
    // something the reader never typed.
    if (!ctx.stdin) { await searchDocs(ctx, pattern); return }
    const invert = line.flags.v === true
    const needle = pattern.toLowerCase()
    for (const l of ctx.stdin.filter((x) => x.toLowerCase().includes(needle) !== invert)) ctx.print(l)
  },
})

const theme = defineCommand({
  name: 'theme',
  description: 'switch the colour scheme',
  usage: 'theme [name]',
  details: [
    `Available: ${themeNames.join(', ')}.`,
    '',
    'With no name it opens a chooser: ↑↓ preview each one live, Enter keeps',
    'it, Escape puts the old one back. Tapping a row selects it; tapping the',
    'selected row keeps it.',
    '',
    'Media quantized to 16 colours follows the theme, so images recolour too.',
  ].join('\n'),
  complete: () => themeNames,
  run(ctx, line) {
    const name = line.args[0]

    if (name) {
      if (!Object.hasOwn(themes, name)) {
        ctx.error(`theme: unknown theme "${name}" (try: ${themeNames.join(', ')})`)
        return
      }
      ctx.setTheme(name)
      ctx.note(`theme: ${name}`)
      return
    }

    const before = ctx.settings.theme
    ctx.choose({
      choices: themeNames.map((n) => ({
        label: themes[n].label,
        value: n,
        extra: themes[n].ansi.map((_, i) => `<i class="sw f${i}"> </i>`).join(''),
      })),
      selected: Math.max(0, themeNames.indexOf(before)),
      // Previewing is the whole point of a theme picker; nothing is written
      // down until it is confirmed.
      onPreview: (choice) => ctx.setTheme(choice.value, false),
      onConfirm: (choice) => { ctx.setTheme(choice.value); ctx.note(`theme: ${choice.value}`) },
      onCancel: () => { if (ctx.settings.theme !== before) ctx.setTheme(before, false) },
    })
  },
})

const render = defineCommand({
  name: 'render',
  description: 'control how images are drawn',
  usage: 'render [--real|--ascii|--hybrid] [--colors 16|256|true] [--columns <n>]',
  details: [
    'hybrid  half-block art paints first, then the real image resolves over it',
    'ascii   art only',
    'real    the original image, framed',
    '',
    '--colors 16 quantizes into the active theme palette, so art recolours',
    'when you switch theme. 256 and true use absolute colour and do not.',
    'Your choice is remembered in this browser.',
  ].join('\n'),
  complete: (_ctx, partial, index) =>
    (index === 1 ? ['--real', '--ascii', '--hybrid', '--colors', '--columns'] : ['16', '256', 'true'])
      .filter((s) => s.startsWith(partial)),
  run(ctx, line) {
    const patch: Record<string, unknown> = {}
    if (line.flags.real) patch.mediaMode = 'real'
    if (line.flags.ascii) patch.mediaMode = 'ascii'
    if (line.flags.hybrid) patch.mediaMode = 'hybrid'
    const colors = line.flags.colors
    if (typeof colors === 'string') {
      if (colors === '16' || colors === '256') patch.mediaColors = Number(colors)
      else if (colors === 'true' || colors === 'truecolor') patch.mediaColors = 'true'
      else { ctx.error(`render: --colors expects 16, 256 or true`); return }
    }
    const cols = line.flags.columns
    if (typeof cols === 'string') {
      const n = Number(cols)
      if (!Number.isFinite(n) || n < 16 || n > 200) { ctx.error('render: --columns expects 16-200'); return }
      patch.mediaColumns = Math.round(n)
    }
    if (Object.keys(patch).length) ctx.applySettings(patch)
    const s = ctx.settings
    ctx.printHtml([
      `<span class="dim">media  </span> ${esc(s.mediaMode)}${s.mediaMode === 'hybrid' ? ' <span class="dim">(art → real)</span>' : ''}`,
      `<span class="dim">colors </span> ${esc(String(s.mediaColors))}${s.mediaColors === 16 ? ' <span class="dim">(theme palette)</span>' : ''}`,
      `<span class="dim">columns</span> ${s.mediaColumns}`,
    ].join('\n'))
  },
})

const pageFlag = (line: { flags: Record<string, string | true>; args: string[] }): number | undefined => {
  const raw = typeof line.flags.page === 'string' ? line.flags.page : line.args[0]
  const n = Number(raw)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : undefined
}

const blog = defineCommand({
  name: 'blog',
  aliases: ['b', 'archive', 'index', 'home'],
  description: 'open the blog',
  usage: 'blog [page] [--tag <tag>]',
  details: [
    'Runs the blog as a full-screen application, the way `less` or `man` do.',
    'It owns the keyboard while it runs: ↑↓ select, ←→ turn the page, Enter',
    'reads. `q` hands the screen back to this shell with your scrollback',
    'exactly as you left it. `--tag <tag>` narrows the listing to one tag, and',
    'a page number opens the archive part-way down.',
  ].join('\n'),
  run(ctx, line) {
    const tag = typeof line.flags.tag === 'string' ? line.flags.tag : null
    const list = tag ? ctx.content.posts.filter((d) => d.tags.includes(tag)) : ctx.content.posts
    listDocs(ctx, list, tag ? `tagged ${tag}` : 'posts', pageFlag(line))
  },
})

const clear = defineCommand({
  name: 'clear',
  aliases: ['cls'],
  description: 'clear the shell transcript',
  usage: 'clear',
  details: 'Clears this shell. `blog` is how you get back to the posts.',
  run(ctx) {
    ctx.clear()
    ctx.printHtml(
      `<span class="dim">cleared · </span>` +
      `<button type="button" class="tok tok-cmd" data-cmd="blog">blog</button>` +
      `<span class="dim"> · </span>` +
      `<button type="button" class="tok tok-cmd" data-cmd="help">help</button>`,
      'term-greeting')
  },
})

const history = defineCommand({
  name: 'history',
  description: 'show previously run commands',
  usage: 'history [-c]',
  run(ctx, line) {
    if (line.flags.c) return ctx.exec('__clear_history')
    ctx.printHtml(historyHtml(), 'term-history')
  },
})

let historyProvider: () => readonly string[] = () => []
export const setHistoryProvider = (fn: () => readonly string[]) => { historyProvider = fn }
let historyClearer: () => void = () => {}
export const setHistoryClearer = (fn: () => void) => { historyClearer = fn }

function historyHtml(): string {
  const items = historyProvider()
  if (!items.length) return '<span class="dim">no history yet</span>'
  const w = String(items.length).length
  return items.map((line, i) =>
    `<span class="dim">${String(i + 1).padStart(w)}</span>  ${action(line, line, 'tok-cmd')}`).join('\n')
}

const clearHistory = defineCommand({
  name: '__clear_history',
  description: 'clear stored history',
  hidden: true,
  run(ctx) { historyClearer(); ctx.note('history cleared') },
})

const whoami = defineCommand({
  name: 'whoami',
  description: 'print the current user',
  run(ctx) { ctx.print(ctx.site.user) },
})

const date = defineCommand({
  name: 'date',
  description: 'print the current date and time',
  run(ctx) { ctx.print(new Date().toString()) },
})

const echo = defineCommand({
  name: 'echo',
  description: 'print the arguments back',
  usage: 'echo <text...>',
  run(ctx, line) { ctx.print(line.args.join(' ')) },
})

const tags = defineCommand({
  name: 'tags',
  description: 'choose a tag to browse',
  details: 'Arrows and Enter, or tap a row and tap it again to open it.',
  run(ctx) {
    const entries = Object.entries(ctx.content.tags).sort((a, b) => b[1].length - a[1].length)
    if (!entries.length) { ctx.note('no tags'); return }
    if (ctx.piped) {
      for (const [tag, list] of entries) ctx.print(`${tag} ${list.length}`)
      return
    }
    ctx.choose({
      choices: entries.map(([tag, list]) => ({
        label: tag,
        value: tag,
        hint: `${list.length} post${list.length === 1 ? '' : 's'}`,
      })),
      onConfirm: (choice) => { ctx.exec(`blog --tag ${choice.value}`) },
    })
  },
})

const about = defineCommand({
  name: 'about',
  description: 'about this site',
  run(ctx) { if (!ctx.page('about')) ctx.error('about: missing content/pages/about.md') },
})

const links = defineCommand({
  name: 'links',
  description: 'links elsewhere',
  run(ctx) { if (!ctx.page('links')) ctx.error('links: missing content/pages/links.md') },
})



const neofetch = defineCommand({
  name: 'neofetch',
  aliases: ['info'],
  description: 'site information, with a logo',
  run(ctx) {
    // Every logo row is LOGO_W cells wide; rows past the logo must pad to the
    // same width or the label column steps left halfway down.
    const LOGO_W = 11
    const logo = [
      '  <i class="f9">▄▄▄▄▄▄▄</i>  ',
      ' <i class="f9">█</i><i class="f11">▀▀▀▀▀▀▀</i><i class="f9">█</i> ',
      ' <i class="f9">█</i> <i class="f12">▄▄▄</i> <i class="f9">▄</i> <i class="f9">█</i> ',
      ' <i class="f9">█</i> <i class="f12">█</i><i class="f14">_</i><i class="f12">█</i> <i class="f9">█</i> <i class="f9">█</i> ',
      ' <i class="f9">█</i><i class="f11">▄▄▄▄▄▄▄</i><i class="f9">█</i> ',
      '  <i class="f9">▀▀▀▀▀▀▀</i>  ',
    ]
    const { posts: p, pages, tags: t } = ctx.content
    const words = p.reduce((n, d) => n + d.words, 0)
    const rows = [
      [`${ctx.site.user}@${ctx.site.host}`, ''],
      ['─────────────', ''],
      ['site', ctx.site.title],
      ['posts', String(p.length)],
      ['pages', String(pages.length)],
      ['tags', String(Object.keys(t).length)],
      ['words', words.toLocaleString('en-US')],
      ['latest', p[0]?.slug ?? '—'],
      ['theme', ctx.settings.theme],
      ['media', `${ctx.settings.mediaMode} · ${ctx.settings.mediaColors} colors`],
      ['built', ctx.content.builtAt.slice(0, 10)],
    ]
    const swatch = '\n' + Array.from({ length: 8 }, (_, i) => `<i class="sw f${i}"> </i>`).join('') +
      '\n' + Array.from({ length: 8 }, (_, i) => `<i class="sw f${i + 8}"> </i>`).join('')
    const body = rows.map(([k, v], i) => {
      const art = logo[i] ?? ' '.repeat(LOGO_W)
      if (!v) return `${art}  <span class="accent">${esc(k)}</span>`
      return `${art}  <span class="dim">${esc(padEnd(k, 7))}</span> ${esc(v)}`
    }).join('\n')
    ctx.printHtml(body + swatch, 'term-neofetch')
  },
})

const exit = defineCommand({
  name: 'exit',
  aliases: ['quit', 'q'],
  description: 'say goodbye',
  run(ctx) {
    ctx.note('there is no exit from a static site. try `blog`.')
  },
})

export const builtins: Command[] = [
  blog, grep,
  help, man, ls, cd, pwd, tree, cat, open, find, theme, render, clear,
  history, clearHistory, whoami, date, echo, tags, about, links, neofetch, exit,
]
