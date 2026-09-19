import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ListView } from '../src/render/postlist.js'
import type { Doc } from '../src/types.js'

const doc = (n: number): Doc => ({
  slug: `post-${n}`, title: `Post ${n}`, summary: '', lang: 'en', tags: ['t'],
  date: `2026-01-${String(n).padStart(2, '0')}`, path: `/posts/2026/post-${n}.md`,
  url: `/posts/post-${n}/`, aliases: [], bytes: 0, words: 1, minutes: 1,
})

const docs = (n: number) => Array.from({ length: n }, (_, i) => doc(i + 1))

const make = (n: number, onOpen = vi.fn()) =>
  new ListView(docs(n), { perPage: 8, onOpen })

describe('pagination', () => {
  let list: ListView
  beforeEach(() => { list = make(12) })

  it('reports the page count from the item count', () => {
    expect(list.pages).toBe(2)
    expect(make(8).pages).toBe(1)
    expect(make(9).pages).toBe(2)
    expect(make(0).pages).toBe(1)
  })

  it('starts on page one with the first row selected', () => {
    expect(list.page).toBe(1)
    expect(list.selected).toBe(0)
  })

  it('derives the page from the selection', () => {
    list.move(8)
    expect(list.selected).toBe(8)
    expect(list.page).toBe(2)
  })

  it('walking off the bottom of a page turns it', () => {
    for (let i = 0; i < 8; i++) list.move(1)
    expect(list.page).toBe(2)
    expect(list.selected).toBe(8)
  })

  it('wraps at the end of the whole list, not the page', () => {
    list.move(11)
    expect(list.selected).toBe(11)
    list.move(1)
    expect(list.selected).toBe(0)
    expect(list.page).toBe(1)
  })

  it('wraps backwards from the first row to the last', () => {
    list.move(-1)
    expect(list.selected).toBe(11)
    expect(list.page).toBe(2)
  })

  it('forward paging lands on the first row of the new page', () => {
    list.pageBy(1)
    expect(list.page).toBe(2)
    expect(list.selected).toBe(8)
  })

  it('backward paging lands on the last row of the previous page', () => {
    list.pageBy(1)
    list.pageBy(-1)
    expect(list.page).toBe(1)
    expect(list.selected).toBe(7)
  })

  it('refuses to page past either end', () => {
    list.pageBy(-1)
    expect(list.page).toBe(1)
    list.pageBy(1)
    list.pageBy(1)
    expect(list.page).toBe(2)
  })

  it('setPage rejects out-of-range pages', () => {
    expect(list.setPage(2)).toBe(true)
    expect(list.setPage(3)).toBe(false)
    expect(list.setPage(0)).toBe(false)
    expect(list.page).toBe(2)
  })

  it('reports page changes once per change', () => {
    const onPage = vi.fn()
    const l = new ListView(docs(12), { perPage: 8, onOpen: vi.fn(), onPage })
    onPage.mockClear()
    l.move(1)
    expect(onPage).not.toHaveBeenCalled()
    l.pageBy(1)
    expect(onPage).toHaveBeenCalledWith(2)
    expect(onPage).toHaveBeenCalledTimes(1)
  })
})

describe('rendering', () => {
  it('renders exactly one page of rows', () => {
    const list = make(12)
    expect(list.el.querySelectorAll('.pl-row')).toHaveLength(8)
    list.pageBy(1)
    expect(list.el.querySelectorAll('.pl-row')).toHaveLength(4)
  })

  it('marks the selected row and only that row', () => {
    const list = make(12)
    list.move(3)
    const marked = list.el.querySelectorAll('.pl-row.is-selected')
    expect(marked).toHaveLength(1)
    expect((marked[0] as HTMLElement).dataset.index).toBe('3')
  })

  it('reports the visible range and label in the footer', () => {
    const list = new ListView(docs(12), { perPage: 8, label: 'tagged design', onOpen: vi.fn() })
    expect(list.el.querySelector('.pl-pos')?.textContent).toContain('1–8 of 12 tagged design')
    list.pageBy(1)
    expect(list.el.querySelector('.pl-pos')?.textContent).toContain('9–12 of 12')
  })

  it('hides the pager when everything fits on one page', () => {
    expect(make(5).el.querySelector('.pl-nav')).toBeNull()
  })

  it('disables the edge buttons', () => {
    const list = make(12)
    expect(list.el.querySelector('[data-page="prev"]')?.hasAttribute('disabled')).toBe(true)
    list.pageBy(1)
    expect(list.el.querySelector('[data-page="next"]')?.hasAttribute('disabled')).toBe(true)
  })

  it('says so when there is nothing to list', () => {
    const list = make(0)
    expect(list.el.querySelector('.pl-empty')).not.toBeNull()
    expect(list.current()).toBeNull()
    expect(list.openCurrent()).toBe(false)
  })

  it('drops the highlight once demoted', () => {
    const list = make(12)
    list.deactivate()
    expect(list.el.querySelectorAll('.pl-row.is-selected')).toHaveLength(0)
    expect(list.el.classList.contains('is-stale')).toBe(true)
  })

  it('opens the selection through the callback', () => {
    const onOpen = vi.fn()
    const list = make(12, onOpen)
    list.move(2)
    expect(list.openCurrent()).toBe(true)
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ slug: 'post-3' }))
  })
})

describe('the pointer', () => {
  const rowAt = (list: ListView, i: number) =>
    list.el.querySelector<HTMLElement>(`.pl-row[data-index="${i}"]`)!

  it('selects a row you click without opening it', () => {
    const onOpen = vi.fn()
    const list = make(12, onOpen)
    rowAt(list, 3).click()
    expect(list.selected).toBe(3)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('opens the row you click twice', () => {
    const onOpen = vi.fn()
    const list = make(12, onOpen)
    rowAt(list, 3).click()
    rowAt(list, 3).click()
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ slug: 'post-4' }))
  })

  it('is one click for a row already selected, which is what hover leaves', () => {
    const onOpen = vi.fn()
    const list = make(12, onOpen)
    rowAt(list, 0).click()
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ slug: 'post-1' }))
  })
})
