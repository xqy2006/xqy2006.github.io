import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Editor } from '../src/apps/editor.js'

type SaveResult = { ok: true } | { ok: false; error: string }
type SaveFn = (path: string, text: string) => SaveResult

const mount = (save: SaveFn = () => ({ ok: true }), quit = vi.fn()) => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  return { editor: new Editor(host, { save, quit }), save, quit }
}

const area = (e: Editor) => e.el.querySelector('textarea') as HTMLTextAreaElement

describe('editor', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('loads a file and is clean', () => {
    const { editor } = mount()
    editor.load('/home/guest/a.py', 'print(1)')
    expect(editor.text).toBe('print(1)')
    expect(editor.file).toBe('/home/guest/a.py')
    expect(editor.dirty).toBe(false)
  })

  it('becomes dirty when the text changes', () => {
    const { editor } = mount()
    editor.load('/home/guest/a.py', 'print(1)')
    area(editor).value = 'print(2)'
    expect(editor.dirty).toBe(true)
  })

  it('saves through the hook and comes back clean', () => {
    const save = vi.fn<SaveFn>(() => ({ ok: true }))
    const { editor } = mount(save)
    editor.load('/home/guest/a.py', 'old')
    area(editor).value = 'new'
    expect(editor.save()).toBe(true)
    expect(save).toHaveBeenCalledWith('/home/guest/a.py', 'new')
    expect(editor.dirty).toBe(false)
  })

  it('stays dirty when the store refuses the write', () => {
    const save = vi.fn<SaveFn>(() => ({ ok: false, error: 'out of space' }))
    const { editor } = mount(save)
    editor.load('/home/guest/a.py', 'old')
    area(editor).value = 'new'
    expect(editor.save()).toBe(false)
    expect(editor.dirty).toBe(true)
    expect(editor.el.querySelector('.screen-status')?.textContent).toMatch(/out of space/)
  })

  it('quits straight away when nothing is unsaved', () => {
    const { editor, quit } = mount()
    editor.load('/home/guest/a.py', 'x')
    expect(editor.tryQuit()).toBe(true)
    expect(quit).toHaveBeenCalledOnce()
  })

  it('warns on the first quit with unsaved work and leaves on the second', () => {
    const { editor, quit } = mount()
    editor.load('/home/guest/a.py', 'old')
    area(editor).value = 'new'
    expect(editor.tryQuit()).toBe(false)
    expect(quit).not.toHaveBeenCalled()
    expect(editor.el.querySelector('.screen-status')?.textContent).toMatch(/unsaved/)
    expect(editor.tryQuit()).toBe(true)
    expect(quit).toHaveBeenCalledOnce()
  })

  it('re-arms the warning after another edit', () => {
    const { editor, quit } = mount()
    editor.load('/home/guest/a.py', 'old')
    area(editor).value = 'new'
    editor.tryQuit()
    area(editor).dispatchEvent(new Event('input'))
    expect(editor.tryQuit()).toBe(false)
    expect(quit).not.toHaveBeenCalled()
  })

  it('counts lines in the status', () => {
    const { editor } = mount()
    editor.load('/home/guest/a.py', 'a\nb\nc')
    expect(editor.el.querySelector('.screen-pos')?.textContent).toMatch(/3 lines/)
    editor.load('/home/guest/empty', '')
    expect(editor.el.querySelector('.screen-pos')?.textContent).toMatch(/0 lines/)
  })
})
