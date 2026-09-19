import { defineCommand } from '../../core/registry.js'

/**
 * Example user command. Drop any file exporting a Command as `default` into
 * src/commands/user/ and it appears in `help` automatically.
 */
export default defineCommand({
  name: 'toc',
  description: 'print the table of contents of a document',
  usage: 'toc <slug>',
  details: 'Headings are clickable: tapping one opens the document.',
  complete: (ctx, partial) => ctx.vfs.docs().map((d) => d.slug).filter((s) => s.startsWith(partial)),
  async run(ctx, line) {
    const ref = line.args[0]
    if (!ref) { ctx.error('toc: missing operand'); return }
    const doc = ctx.vfs.resolveDoc(ref)
    if (!doc) { ctx.error(`toc: ${ref}: no such document`); return }
    const body = await ctx.body(doc.slug)
    if (!body?.toc.length) { ctx.note('(no headings)'); return }
    const html = body.toc.map((h) => {
      const indent = '  '.repeat(Math.max(0, h.depth - 1))
      const bullet = h.depth === 1 ? '#' : '·'
      return `<span class="dim">${indent}${bullet}</span> ` +
        `<button type="button" class="tok tok-doc" data-cmd="open ${doc.slug}">${h.text.replace(/[<>&]/g, '')}</button>`
    }).join('\n')
    ctx.printHtml(html)
  },
})
