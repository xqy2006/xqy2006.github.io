import { describe, it, expect, vi, afterAll } from 'vitest'
import { ScreenStack } from '../src/core/screens.js'
import { Blog, type BlogOptions } from '../src/apps/blog.js'
import { Reader } from '../src/apps/reader.js'
import { createRenderer } from '../build/markdown.js'
import type { Doc } from '../src/types.js'

const doc = (n: number): Doc => ({
  slug: `post-${n}`, title: `Post ${n}`, summary: '', lang: 'en', tags: ['t'],
  date: `2026-01-${String(n).padStart(2, '0')}`, path: `/posts/2026/post-${n}.md`,
  url: `/posts/post-${n}/`, aliases: [], bytes: 4, words: 1, minutes: 1,
})
const docs = (n: number) => Array.from({ length: n }, (_, i) => doc(i + 1))

// One stack for the file: ScreenStack installs a capturing document keydown
// listener, and vitest runs with isolate:false.
const screens = new ScreenStack()
afterAll(() => screens.clear())

const opts = (over: Partial<BlogOptions> = {}): BlogOptions => ({
  title: 'ProseOS',
  description: 'A static blog that behaves like a shell.',
  perPage: 8,
  onOpen: vi.fn(),
  onPage: vi.fn(),
  onQuit: vi.fn(),
  onCommand: vi.fn(),
  ...over,
})

describe('blog.currentPage is right while onPage fires', () => {
  it('reports the deep-linked page to syncUrl, not the one before it', () => {
    const seen: Array<[number, number]> = []
    let blog: Blog
    const o = opts({ onPage: (p: number) => seen.push([p, blog.currentPage]) })
    blog = new Blog(document.body, o, { docs: docs(24), label: 'posts' })

    // What main.openBlog({page: 3}) does, then what ScreenStack.push does.
    blog.show({ docs: docs(24), label: 'posts', page: 3 })
    screens.push(blog)

    // syncUrl reads currentPage from inside the onPage callback, so it has to
    // be the page being reported — not the one the previous list was on.
    expect(blog.currentPage).toBe(3)
    expect(seen).toEqual([[3, 3]])
    screens.pop()
  })

  it('reports the page of the new listing when re-targeted while hidden', () => {
    const seen: Array<[number, number]> = []
    let blog: Blog
    const o = opts({ onPage: (p: number) => seen.push([p, blog.currentPage]) })
    blog = new Blog(document.body, o, { docs: docs(24), label: 'posts' })

    blog.show({ docs: docs(24), label: 'posts', page: 3 })
    screens.push(blog)
    expect(blog.currentPage).toBe(3)
    screens.pop() // `q` to the shell; the element is hidden again

    seen.length = 0
    // `blog --tag design`: a different, shorter listing, no explicit page.
    blog.show({ docs: docs(5), label: 'tagged design' })
    screens.push(blog)

    expect(blog.currentPage).toBe(1)          // page 1 of the tag listing is drawn
    expect(seen).toEqual([[1, 1]])            // and that is what syncUrl is told
    screens.pop()
  })
})

describe('Enter and Space belong to the focused control inside a screen', () => {
  it('Enter on the blog quit button is left to the button', () => {
    const onOpen = vi.fn()
    const blog = new Blog(document.body, opts({ onOpen }), { docs: docs(24), label: 'posts' })
    screens.push(blog)

    const quit = blog.el.querySelector<HTMLButtonElement>('.screen-key-quit')!
    quit.focus()
    const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    quit.dispatchEvent(e)

    expect(e.defaultPrevented).toBe(false) // the button activates normally
    expect(onOpen).not.toHaveBeenCalled()  // and no post is opened behind it
    screens.pop()
  })

  it('Enter on a focused row is left to that row', () => {
    const onOpen = vi.fn()
    const blog = new Blog(document.body, opts({ onOpen }), { docs: docs(24), label: 'posts' })
    screens.push(blog)

    const rows = blog.el.querySelectorAll<HTMLButtonElement>('.pl-row')
    rows[4].focus()
    rows[4].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))

    // The row is a real button; its own activation opens it, and the screen
    // must not also open whatever the arrow keys had selected.
    expect(onOpen).not.toHaveBeenCalled()
    screens.pop()
  })

  it('Space on a focused tag button in the reader is left to the button', () => {
    const reader = new Reader(document.body, {
      onRender: () => {}, onOpen: () => {}, onQuit: () => {}, onClose: () => {},
    })
    reader.load(doc(1), { html: '<p>body</p>', toc: [] })
    screens.push(reader)

    const tag = reader.el.querySelector<HTMLButtonElement>('.md-tag')!
    tag.focus()
    const e = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    tag.dispatchEvent(e)

    expect(e.defaultPrevented).toBe(false) // the button activates; no scroll
    screens.pop()
  })
})

describe('markdown image nesting', () => {
  const render = (md: string) => createRenderer().parse(md, { async: false }) as string

  it('does not wrap a standalone image in a paragraph', () => {
    const html = render('![alt](/img/x.png)')
    expect(html).not.toContain('<p>')
    expect(html).toContain('<span class="md-media"')
  })

  it('keeps text after an inline image inside the same paragraph', () => {
    const html = render('before ![alt](/img/x.png) after')
    const host = document.createElement('div')
    host.innerHTML = html
    // A span is phrasing content, so the browser does not close the <p> at it
    // and nothing after the image is orphaned.
    const media = host.querySelector('.md-media')!
    expect(media.closest('p')).not.toBeNull()
    expect(host.querySelector('p')!.textContent).toContain('after')
  })
})
