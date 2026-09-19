import { defineCommand, type Command } from '../core/registry.js'
import { escapeHtml } from '../core/terminal.js'
import { loadAliases, saveAliases } from '../core/settings.js'
import { parseAliasArg } from '../core/expand.js'
import { renderBanner, bannerWidth, unsupported } from '../render/figlet.js'
import { padEnd, width } from '../render/width.js'
import type { Doc } from '../types.js'

const esc = escapeHtml

const alias = defineCommand({
  name: 'alias',
  description: 'name a command, or list the names you have made',
  usage: "alias [name='command']",
  details: [
    "alias ll='ls -l'        define one",
    'alias                   list them',
    'unalias ll              remove one',
    '',
    'Names expand at the start of a line and after a pipe, once — an alias',
    'that names itself will not loop. They are kept in this browser.',
  ].join('\n'),
  run(ctx, line) {
    const aliases = loadAliases()
    const raw = line.raw.replace(/^\s*alias\s*/, '').trim()
    if (!raw) {
      const names = Object.keys(aliases).sort()
      if (!names.length) { ctx.note("no aliases yet — try alias ll='ls -l'"); return }
      const w = Math.max(...names.map(width))
      ctx.printHtml(names.map((n) =>
        `<span class="accent">${esc(padEnd(n, w))}</span>  <span class="dim">${esc(aliases[n])}</span>`).join('\n'))
      return
    }
    const parsed = parseAliasArg(raw)
    if (!parsed) { ctx.error("alias: expected name='command'"); return }
    aliases[parsed.name] = parsed.value
    saveAliases(aliases)
    ctx.note(`${parsed.name} → ${parsed.value}`)
  },
})

const unalias = defineCommand({
  name: 'unalias',
  description: 'remove an alias',
  usage: 'unalias <name>',
  complete: () => Object.keys(loadAliases()),
  run(ctx, line) {
    const name = line.args[0]
    const aliases = loadAliases()
    if (!name) { ctx.error('unalias: missing name'); return }
    if (!(name in aliases)) { ctx.error(`unalias: ${name}: not found`); return }
    delete aliases[name]
    saveAliases(aliases)
    ctx.note(`removed ${name}`)
  },
})

const figlet = defineCommand({
  name: 'figlet',
  aliases: ['banner'],
  description: 'print text in block letters',
  usage: 'figlet <text>',
  details: 'The same five-row font the masthead is drawn with.\nLatin letters, digits and - . _ only.',
  run(ctx, line) {
    const text = line.args.join(' ').trim()
    if (!text) { ctx.error('figlet: missing text'); return }
    const cols = ctx.columns()
    let shown = text
    while (shown.length > 1 && bannerWidth(shown) > cols) shown = shown.slice(0, -1)
    const missing = unsupported(shown)
    if (missing.length === [...new Set([...shown.toUpperCase()])].length) {
      ctx.error(`figlet: no block letters for ${missing.join(' ')} — Latin letters and digits only`)
      return
    }
    ctx.printHtml(`<span class="accent">${esc(renderBanner(shown).join('\n'))}</span>`)
    const notes = []
    if (shown !== text) notes.push(`cut to fit ${cols} columns`)
    if (missing.length) notes.push(`no block letters for ${missing.join(' ')}`)
    if (notes.length) ctx.note(`(${notes.join(' · ')})`)
  },
})

const random = defineCommand({
  name: 'random',
  aliases: ['lucky'],
  description: 'open a post at random',
  run(ctx) {
    const posts = ctx.content.posts
    if (!posts.length) { ctx.note('no posts'); return }
    ctx.page(posts[Math.floor(Math.random() * posts.length)].slug)
  },
})

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Every day of a year as one cell: a posting heatmap that fits a phone. */
const cal = defineCommand({
  name: 'cal',
  description: 'show a year of posting as a calendar',
  usage: 'cal [year|--all]',
  details: [
    'Months down the side, days across. A day you posted is marked and can be',
    'tapped to read it. With no argument it shows the most recent year that',
    'has posts; --all lists every year with a count.',
  ].join('\n'),
  run(ctx, line) {
    const posts = ctx.content.posts.filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date))
    if (!posts.length) { ctx.note('no dated posts'); return }

    const years = [...new Set(posts.map((p) => p.date.slice(0, 4)))].sort()
    if (line.flags.all) {
      ctx.printHtml(years.map((y) => {
        const inYear = posts.filter((p) => p.date.startsWith(y))
        const words = inYear.reduce((n, p) => n + p.words, 0)
        const bar = '▪'.repeat(Math.min(40, inYear.length))
        return `<span class="dim">${y}</span>  <span class="accent">${bar}</span> ` +
          `<span class="dim">${inYear.length} posts · ${words.toLocaleString('en-US')} words</span>`
      }).join('\n'))
      return
    }

    const year = line.args[0] && /^\d{4}$/.test(line.args[0]) ? line.args[0] : years[years.length - 1]
    const byDay = new Map<string, Doc[]>()
    for (const p of posts) {
      if (!p.date.startsWith(year)) continue
      const list = byDay.get(p.date) ?? []
      list.push(p)
      byDay.set(p.date, list)
    }
    if (!byDay.size) { ctx.note(`no posts in ${year}`); return }

    const header = '     ' + Array.from({ length: 31 }, (_, i) =>
      (i + 1) % 5 === 0 ? String((i + 1) % 10) : '·').join('')
    const rows = MONTHS.map((label, m) => {
      const days = Array.from({ length: 31 }, (_, d) => {
        const iso = `${year}-${String(m + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`
        const hit = byDay.get(iso)
        if (!hit) return '<span class="cal-off">·</span>'
        const title = hit.map((p) => p.title).join(', ')
        return `<button type="button" class="cal-on" data-cmd="open ${esc(hit[0].slug)}"` +
          ` title="${esc(iso)} — ${esc(title)}">▪</button>`
      }).join('')
      const count = [...byDay.entries()].filter(([iso]) => iso.startsWith(`${year}-${String(m + 1).padStart(2, '0')}`))
        .reduce((n, [, v]) => n + v.length, 0)
      return `<span class="dim">${label}</span>  ${days}${count ? `  <span class="dim">${count}</span>` : ''}`
    }).join('\n')

    const inYear = posts.filter((p) => p.date.startsWith(year))
    const words = inYear.reduce((n, p) => n + p.words, 0)
    ctx.printHtml(
      `<span class="accent">${year}</span>\n<span class="dim">${header}</span>\n${rows}\n` +
      `<span class="dim">${inYear.length} posts · ${words.toLocaleString('en-US')} words · ` +
      `${years.length > 1 ? 'cal --all for every year' : 'tap a mark to read it'}</span>`,
      'term-cal')
  },
})

export const shellish: Command[] = [alias, unalias, figlet, random, cal]
