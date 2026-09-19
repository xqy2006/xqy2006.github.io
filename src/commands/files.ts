import { defineCommand, type Command } from '../core/registry.js'
import { escapeHtml } from '../core/terminal.js'
import { padEnd, width } from '../render/width.js'
import { STORE_LIMIT } from '../core/filestore.js'

const esc = escapeHtml

/** Commands that touch the writable tree. Everything else is read-only. */

const edit = defineCommand({
  name: 'edit',
  aliases: ['nano', 'vi', 'vim'],
  description: 'edit a file in the home directory',
  usage: 'edit <file>',
  details: [
    'Opens a full-screen editor. ^S saves, ^Q quits — twice if there are',
    'unsaved changes. Only ~ is writable; posts are read-only.',
    '',
    'It is deliberately not an IDE: save, quit, then `python file.py`.',
  ].join('\n'),
  complete: (ctx) => ctx.files.list().filter((e) => e.kind === 'file').map((e) => `~/${e.name}`),
  run(ctx, line) {
    const target = line.args[0]
    if (!target) { ctx.error('edit: which file?'); return }
    const { store, path } = ctx.resolve(target)
    if (!store) { ctx.error(`edit: ${target}: read-only (only ${ctx.files.root} is writable)`); return }
    ctx.edit(path)
  },
})

const touch = defineCommand({
  name: 'touch',
  description: 'create an empty file',
  usage: 'touch <file>',
  run(ctx, line) {
    const target = line.args[0]
    if (!target) { ctx.error('touch: which file?'); return }
    const { store, path } = ctx.resolve(target)
    if (!store) { ctx.error(`touch: ${target}: read-only`); return }
    if (ctx.files.has(path)) return
    const r = ctx.files.write(path, '')
    if (!r.ok) ctx.error(`touch: ${r.error}`)
  },
})

const rm = defineCommand({
  name: 'rm',
  description: 'delete a file from the home directory',
  usage: 'rm <file>',
  complete: (ctx) => ctx.files.list().filter((e) => e.kind === 'file').map((e) => `~/${e.name}`),
  run(ctx, line) {
    const target = line.args[0]
    if (!target) { ctx.error('rm: which file?'); return }
    const { store, path } = ctx.resolve(target)
    if (!store) { ctx.error(`rm: ${target}: read-only — posts are not yours to delete`); return }
    if (!ctx.files.remove(path)) ctx.error(`rm: ${target}: no such file`)
  },
})

const df = defineCommand({
  name: 'df',
  description: 'show how much of the home directory is used',
  run(ctx) {
    const used = ctx.files.bytes
    const files = ctx.files.entries().length
    const pct = Math.min(100, Math.round((used / STORE_LIMIT) * 100))
    const bar = '█'.repeat(Math.round(pct / 5)) + '·'.repeat(20 - Math.round(pct / 5))
    ctx.printHtml(
      `<span class="dim">${esc(ctx.files.root)}</span>  <span class="accent">${bar}</span>  ` +
      `<span class="dim">${(used / 1024).toFixed(1)} KB of ${Math.round(STORE_LIMIT / 1024)} KB · ` +
      `${files} file${files === 1 ? '' : 's'}</span>`)
  },
})

/** `ls` for the writable tree; the read-only one is handled in builtin.ts. */
export function listStore(ctx: import('../core/registry.js').Ctx, dir: string, long: boolean): void {
  const entries = ctx.files.list(dir)
  if (!entries.length) {
    // A file is its own listing, the way `ls` reports one.
    if (ctx.files.has(dir)) ctx.print(dir.slice(dir.lastIndexOf('/') + 1))
    return // otherwise an empty directory says nothing
  }
  // A pipe wants one entry per line, not however many fit across the window.
  if (ctx.piped) {
    for (const e of entries) ctx.print(e.kind === 'dir' ? `${e.name}/` : e.name)
    return
  }
  if (long) {
    const w = Math.max(...entries.map((e) => width(e.name)))
    ctx.printHtml(entries.map((e) => {
      const size = e.kind === 'file' ? String((ctx.files.read(`${dir}/${e.name}`) ?? '').length).padStart(6) : '     -'
      const label = e.kind === 'dir' ? `${e.name}/` : e.name
      const cls = e.kind === 'dir' ? 'tok-dir' : 'tok-doc'
      const cmd = e.kind === 'dir' ? `cd ${dir}/${e.name}` : `edit ${dir}/${e.name}`
      return `<span class="dim">${e.kind === 'dir' ? 'd' : '-'}rw-r--r--</span> ${size}  ` +
        `<button type="button" class="tok ${cls}" data-cmd="${esc(cmd)}">${esc(padEnd(label, w))}</button>`
    }).join('\n'), 'term-list')
    return
  }
  ctx.printHtml(entries.map((e) => {
    const label = e.kind === 'dir' ? `${e.name}/` : e.name
    const cls = e.kind === 'dir' ? 'tok-dir' : 'tok-doc'
    const cmd = e.kind === 'dir' ? `cd ${dir}/${e.name}` : `edit ${dir}/${e.name}`
    return `<button type="button" class="tok ${cls}" data-cmd="${esc(cmd)}">${esc(label)}</button>`
  }).join('  '), 'term-list')
}

export const fileCommands: Command[] = [edit, touch, rm, df]
