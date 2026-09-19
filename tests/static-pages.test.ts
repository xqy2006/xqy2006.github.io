import { describe, it, expect } from 'vitest'
import { fillShell, SLOT } from '../build/static-pages.js'

const shell = `<!doctype html>\n<html lang="en">\n<head><title>ProseOS</title></head>\n<body>${SLOT}</body>\n</html>`

describe('filling the prerender shell', () => {
  it('inserts the body', () => {
    expect(fillShell(shell, { body: '<p>hi</p>' })).toContain('<body><p>hi</p></body>')
    expect(fillShell(shell, { body: '<p>hi</p>' })).not.toContain(SLOT)
  })

  it('sets the title and language', () => {
    const out = fillShell(shell, { title: 'A post · ProseOS', lang: 'zh', body: '' })
    expect(out).toContain('<title>A post · ProseOS</title>')
    expect(out).toContain('<html lang="zh">')
  })

  it('adds head content after the title', () => {
    const out = fillShell(shell, { title: 'T', head: '<meta name="x" content="y">', body: '' })
    expect(out).toContain('<title>T</title>')
    expect(out).toContain('<meta name="x" content="y">')
  })

  /**
   * `$&` and `` $` `` are special in a replacement string. A post about shell
   * variables contains both, and used to splice the document head into its own
   * article.
   */
  it('treats $& in the body as literal text', () => {
    const out = fillShell(shell, { body: '<p>sed uses $& for the match</p>' })
    expect(out).toContain('sed uses $& for the match')
    expect(out).not.toContain(SLOT)
  })

  it('treats a backtick-dollar in the body as literal text', () => {
    const out = fillShell(shell, { body: '<p>and $` for the prefix</p>' })
    expect(out).toContain('and $` for the prefix')
    // The give-away of the old bug: the head spliced into the body.
    expect(out.match(/<head>/g)).toHaveLength(1)
  })

  it('treats $1 and $$ in the body as literal text', () => {
    const out = fillShell(shell, { body: '<p>$1 costs $$5</p>' })
    expect(out).toContain('$1 costs $$5')
  })

  it('treats $& in a title as literal text', () => {
    const out = fillShell(shell, { title: 'Cost $& benefit', body: '' })
    expect(out).toContain('<title>Cost $& benefit</title>')
  })

  it('leaves the shell alone when there is nothing to set', () => {
    const out = fillShell(shell, { body: '' })
    expect(out).toContain('<title>ProseOS</title>')
    expect(out).toContain('<html lang="en">')
  })
})
