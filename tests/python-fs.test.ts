import { describe, it, expect } from 'vitest'
import { copyIn, copyOut, mountDocs, type PyodideApi } from '../src/runtime/python.js'
import { FileStore, createMemoryAdapter } from '../src/core/filestore.js'
import type { Doc } from '../src/types.js'

/** A filesystem that behaves enough like Emscripten's for the round trip. */
function fakeFs(): PyodideApi {
  const files = new Map<string, string>()
  const dirs = new Set<string>(['/'])
  return {
    runPythonAsync: async () => undefined,
    setStdout: () => {},
    setStderr: () => {},
    FS: {
      writeFile: (p, d) => { files.set(p, d) },
      readFile: (p) => { if (!files.has(p)) throw new Error('nf'); return files.get(p)! },
      mkdirTree: (p) => {
        const parts = p.split('/').filter(Boolean)
        let cur = ''
        for (const seg of parts) { cur += '/' + seg; dirs.add(cur) }
      },
      readdir: (dir) => {
        const base = dir.replace(/\/$/, '') + '/'
        const names = new Set<string>()
        for (const p of files.keys()) {
          if (!p.startsWith(base)) continue
          names.add(p.slice(base.length).split('/')[0])
        }
        for (const d of dirs) {
          if (!d.startsWith(base)) continue
          const rest = d.slice(base.length)
          if (rest && !rest.includes('/')) names.add(rest)
        }
        return [...names]
      },
      stat: (p) => ({ mode: dirs.has(p) && !files.has(p) ? 1 : 2 }),
      isDir: (mode) => mode === 1,
      unlink: (p) => { files.delete(p) },
    },
  }
}

const store = (seed: Record<string, string> = {}) => {
  const fs = new FileStore(createMemoryAdapter(), '/home/guest')
  for (const [p, t] of Object.entries(seed)) fs.write(p, t)
  return fs
}

const doc = (slug: string, text: string): Doc => ({
  slug, title: slug, summary: '', lang: 'en', tags: [], date: '2026-01-01',
  path: `/posts/2026/${slug}.md`, url: `/posts/${slug}/`, aliases: [], bytes: text.length, words: 1, minutes: 1,
})

describe('copying the home directory in', () => {
  it('writes every file into the python filesystem', () => {
    const py = fakeFs()
    copyIn(py, store({ '~/a.py': 'print(1)', '~/sub/b.py': 'print(2)' }))
    expect(py.FS.readFile('/home/guest/a.py', { encoding: 'utf8' })).toBe('print(1)')
    expect(py.FS.readFile('/home/guest/sub/b.py', { encoding: 'utf8' })).toBe('print(2)')
  })

  it('copes with an empty home', () => {
    const py = fakeFs()
    expect(() => copyIn(py, store())).not.toThrow()
  })
})

describe('copying back out', () => {
  it('brings back a file python created', () => {
    const py = fakeFs()
    const fs = store()
    copyIn(py, fs)
    py.FS.writeFile('/home/guest/out.txt', 'from python', { encoding: 'utf8' })
    expect(copyOut(py, fs).changed).toEqual(['/home/guest/out.txt'])
    expect(fs.read('~/out.txt')).toBe('from python')
  })

  it('brings back a change to an existing file', () => {
    const py = fakeFs()
    const fs = store({ '~/a.py': 'old' })
    copyIn(py, fs)
    py.FS.writeFile('/home/guest/a.py', 'new', { encoding: 'utf8' })
    expect(copyOut(py, fs).changed).toEqual(['/home/guest/a.py'])
    expect(fs.read('~/a.py')).toBe('new')
  })

  it('reports nothing when a run changed nothing', () => {
    const py = fakeFs()
    const fs = store({ '~/a.py': 'same' })
    copyIn(py, fs)
    expect(copyOut(py, fs)).toEqual({ changed: [], removed: [], failed: [] })
  })

  it('walks subdirectories', () => {
    const py = fakeFs()
    const fs = store()
    copyIn(py, fs)
    py.FS.mkdirTree('/home/guest/deep')
    py.FS.writeFile('/home/guest/deep/x.txt', 'hi', { encoding: 'utf8' })
    expect(copyOut(py, fs).changed).toEqual(['/home/guest/deep/x.txt'])
  })

  it('never touches anything outside the home directory', () => {
    const py = fakeFs()
    const fs = store()
    mountDocs(py, [doc('a-post', '# a post')], { 'a-post': '# a post' })
    copyIn(py, fs)
    py.FS.writeFile('/posts/a-post.md', 'tampered', { encoding: 'utf8' })
    expect(copyOut(py, fs).changed).toEqual([])
    expect(fs.read('/posts/a-post.md')).toBeNull()
  })
})

describe('mounting posts', () => {
  it('writes posts where python can read them', () => {
    const py = fakeFs()
    mountDocs(py, [doc('ansi', '# ANSI is an API')], { ansi: '# ANSI is an API' })
    expect(py.FS.readFile('/posts/ansi.md', { encoding: 'utf8' })).toBe('# ANSI is an API')
  })
})
