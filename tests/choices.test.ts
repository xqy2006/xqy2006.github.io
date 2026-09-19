import { describe, it, expect, vi } from 'vitest'
import { ChoiceList, type ChoiceOptions } from '../src/render/choices.js'

const choices = ['nord', 'gruvbox', 'anthropic'].map((v) => ({ label: v, value: v }))

const make = (over: Partial<ChoiceOptions> = {}) => {
  const onConfirm = vi.fn()
  const onPreview = vi.fn()
  const onCancel = vi.fn()
  const list = new ChoiceList({ choices, onConfirm, onPreview, onCancel, ...over })
  return { list, onConfirm, onPreview, onCancel }
}

const rowAt = (list: ChoiceList, i: number) =>
  list.el.querySelector<HTMLElement>(`.cl-row[data-index="${i}"]`)!

describe('the keyboard', () => {
  it('starts on the first row unless told otherwise', () => {
    expect(make().list.current?.value).toBe('nord')
    expect(make({ selected: 2 }).list.current?.value).toBe('anthropic')
  })

  it('wraps at both ends', () => {
    const { list } = make()
    list.move(-1)
    expect(list.current?.value).toBe('anthropic')
    list.move(1)
    expect(list.current?.value).toBe('nord')
  })

  it('previews as it moves but only confirms on demand', () => {
    const { list, onPreview, onConfirm } = make()
    list.move(1)
    expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ value: 'gruvbox' }))
    expect(onConfirm).not.toHaveBeenCalled()
    list.confirm()
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ value: 'gruvbox' }))
  })

  it('cancels once, and is spent afterwards', () => {
    const { list, onCancel, onConfirm } = make()
    list.cancel()
    list.cancel()
    list.confirm()
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(list.settled).toBe(true)
  })
})

describe('the pointer', () => {
  it('selects a row you click, and previews it', () => {
    const { list, onPreview, onConfirm } = make()
    rowAt(list, 1).click()
    expect(list.current?.value).toBe('gruvbox')
    expect(onPreview).toHaveBeenCalledWith(expect.objectContaining({ value: 'gruvbox' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('confirms the row you click twice', () => {
    const { list, onConfirm } = make()
    rowAt(list, 1).click()
    rowAt(list, 1).click()
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ value: 'gruvbox' }))
  })

  it('confirms an already-selected row on the first click', () => {
    const { list, onConfirm } = make()
    rowAt(list, 0).click()
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ value: 'nord' }))
  })

  it('stops taking clicks once settled', () => {
    const { list, onConfirm } = make()
    rowAt(list, 0).click()
    rowAt(list, 2).click()
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(list.el.querySelectorAll('.cl-row[disabled]')).toHaveLength(3)
  })

  it('says what was chosen once it is spent', () => {
    const { list } = make()
    rowAt(list, 2).click()
    rowAt(list, 2).click()
    expect(list.el.querySelector('.cl-foot')?.textContent).toBe('anthropic')
  })

  it('cancels from the footer button, for a phone with no Escape key', () => {
    const { list, onCancel, onConfirm } = make()
    list.el.querySelector<HTMLElement>('.cl-cancel')!.click()
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(list.settled).toBe(true)
  })

  it('has something to say when there is nothing to choose', () => {
    const list = new ChoiceList({ choices: [], onConfirm: vi.fn() })
    expect(list.current).toBeNull()
    list.confirm()
    expect(list.el.textContent).toMatch(/nothing to choose/)
  })
})

describe('settling', () => {
  it('tells the shell before it tells the caller, so the prompt is back first', () => {
    const order: string[] = []
    const list = new ChoiceList({
      choices,
      onConfirm: () => order.push('confirm'),
    })
    list.onSettle = () => order.push('settle')
    list.confirm()
    expect(order).toEqual(['settle', 'confirm'])
  })

  it('tells the shell when it is cancelled too', () => {
    const onSettle = vi.fn()
    const list = new ChoiceList({ choices, onConfirm: vi.fn() })
    list.onSettle = onSettle
    list.cancel()
    list.cancel()
    expect(onSettle).toHaveBeenCalledTimes(1)
  })
})
