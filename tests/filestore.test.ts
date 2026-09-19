import { describe, it, expect, beforeEach } from 'vitest'
import { FileStore, createMemoryAdapter, STORE_LIMIT } from '../src/core/filestore.js'

const make = (seed = {}) => new FileStore(createMemoryAdapter(seed), '/home/guest')

describe('paths', () => {
  const fs = make()
  it('expands ~ to the home directory', () => {
    expect(fs.normalize('~')).toBe('/home/guest')
    expect(fs.normalize('~/a.py')).toBe('/home/guest/a.py')
  })

  it('resolves relative paths against the cwd', () => {
    expect(fs.normalize('a.py')).toBe('/home/guest/a.py')
    expect(fs.normalize('b.py', '/home/guest/sub')).toBe('/home/guest/sub/b.py')
  })

  it('collapses . and ..', () => {
    expect(fs.normalize('~/sub/../a.py')).toBe('/home/guest/a.py')
    expect(fs.normalize('/a/b/./c')).toBe('/a/b/c')
  })

  it('knows what it owns', () => {
    expect(fs.owns('~/a.py')).toBe(true)
    expect(fs.owns('/home/guest')).toBe(true)
    expect(fs.owns('/posts/2026/x.md')).toBe(false)
    expect(fs.owns('/home/guestless/x')).toBe(false)
  })
})

describe('reading and writing', () => {
  let fs: FileStore
  beforeEach(() => { fs = make() })

  it('round-trips a file', () => {
    expect(fs.write('~/a.py', 'print(1)')).toEqual({ ok: true })
    expect(fs.read('~/a.py')).toBe('print(1)')
    expect(fs.has('a.py')).toBe(true)
  })

  it('returns null for a file that is not there', () => {
    expect(fs.read('~/nope')).toBeNull()
  })

  it('refuses to write outside the home directory', () => {
    const r = fs.write('/posts/x.md', 'nope')
    expect(r.ok).toBe(false)
    expect(fs.read('/posts/x.md')).toBeNull()
  })

  it('refuses a write that would exceed the limit', () => {
    const big = 'x'.repeat(STORE_LIMIT)
    const r = fs.write('~/big.txt', big)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/out of space/)
  })

  it('counts an overwrite against the limit only once', () => {
    const half = 'x'.repeat(Math.floor(STORE_LIMIT / 2))
    expect(fs.write('~/a', half).ok).toBe(true)
    expect(fs.write('~/a', half).ok).toBe(true)
  })

  it('removes files and reports whether it did', () => {
    fs.write('~/a', '1')
    expect(fs.remove('~/a')).toBe(true)
    expect(fs.remove('~/a')).toBe(false)
    expect(fs.read('~/a')).toBeNull()
  })

  it('handles CJK content and names', () => {
    fs.write('~/中文.py', 'print("排版")')
    expect(fs.read('~/中文.py')).toBe('print("排版")')
  })
})

describe('listing', () => {
  it('shows files and one entry per subdirectory', () => {
    const fs = make()
    fs.write('~/a.py', '')
    fs.write('~/b.py', '')
    fs.write('~/sub/c.py', '')
    fs.write('~/sub/d.py', '')
    expect(fs.list()).toEqual([
      { name: 'sub', kind: 'dir' },
      { name: 'a.py', kind: 'file' },
      { name: 'b.py', kind: 'file' },
    ])
    expect(fs.list('~/sub').map((e) => e.name)).toEqual(['c.py', 'd.py'])
  })

  it('is empty for an untouched home', () => {
    expect(make().list()).toEqual([])
  })
})

describe('persistence', () => {
  it('loads what a previous session stored', async () => {
    const fs = make({ '/home/guest/old.py': 'print(0)' })
    await fs.load()
    expect(fs.read('~/old.py')).toBe('print(0)')
  })

  it('writes through to the adapter', async () => {
    const adapter = createMemoryAdapter()
    const a = new FileStore(adapter, '/home/guest')
    a.write('~/x', 'hello')
    await Promise.resolve()
    const b = new FileStore(adapter, '/home/guest')
    await b.load()
    expect(b.read('~/x')).toBe('hello')
  })

  it('exposes every file for copying into Python', () => {
    const fs = make()
    fs.write('~/a', '1')
    fs.write('~/sub/b', '2')
    expect(Object.fromEntries(fs.entries())).toEqual({
      '/home/guest/a': '1',
      '/home/guest/sub/b': '2',
    })
  })
})
