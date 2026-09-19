import { describe, it, expect } from 'vitest'
import { copyIn, copyOut, type PyodideApi } from '../src/runtime/python.js'
import { FileStore, createMemoryAdapter, STORE_LIMIT } from '../src/core/filestore.js'

/**
 * Adversarial review. Each assertion states the behaviour the code *should*
 * have; the ones that fail are the findings. Copied fakes from python-fs.test.ts
 * so this file stands alone.
 */
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

describe('deletion across the python round trip', () => {
  // `rm ~/a.txt` then any later `python`/`pip` command.
  it('does not resurrect a file the shell deleted between runs', () => {
    const py = fakeFs()
    const fs = store({ '~/a.txt': 'hi' })

    copyIn(py, fs)          // run 1: /home/guest/a.txt lands in the python FS
    copyOut(py, fs)
    expect(fs.remove('~/a.txt')).toBe(true) // rm ~/a.txt

    copyIn(py, fs)          // run 2: copyIn drops what the shell deleted
    expect(copyOut(py, fs).changed).toEqual([])
    expect(fs.read('~/a.txt')).toBeNull()
  })

  // os.remove('/home/guest/a.txt') inside a script.
  it('propagates a deletion made inside python', () => {
    const py = fakeFs()
    const fs = store({ '~/a.txt': 'hi' })
    copyIn(py, fs)
    py.FS.unlink('/home/guest/a.txt')
    copyOut(py, fs)
    expect(fs.read('~/a.txt')).toBeNull()
  })
})

describe('copying back when the store is full', () => {
  it('does not silently lose a file that did not fit', () => {
    const py = fakeFs()
    const fs = store()
    expect(fs.write('~/big.txt', 'x'.repeat(STORE_LIMIT - 4096)).ok).toBe(true)

    copyIn(py, fs)
    py.FS.writeFile('/home/guest/out.txt', 'y'.repeat(8192), { encoding: 'utf8' })

    const sync = copyOut(py, fs)
    // It genuinely does not fit, so it cannot be stored — but the failure has
    // to be named, or it is indistinguishable from "the script wrote nothing"
    // and the data dies with the tab.
    expect(sync.failed).toHaveLength(1)
    expect(sync.failed[0]).toContain('/home/guest/out.txt')
    expect(sync.failed[0]).toMatch(/out of space/)
    expect(sync.changed).toEqual([])
  })
})

describe('the store before its load resolves', () => {
  /**
   * An adapter with IndexedDB's timing: a read transaction sees the data as it
   * was when the transaction opened, and a `put` issued afterwards lands in a
   * later transaction. `createMemoryAdapter` resolves synchronously and so
   * cannot show this at all.
   */
  const gated = (seed: Record<string, string>) => {
    const map = { ...seed }
    let release = () => {}
    const gate = new Promise<void>((r) => { release = r })
    return {
      map,
      release: () => release(),
      adapter: {
        load: async () => { const snapshot = { ...map }; await gate; return snapshot },
        put: async (p: string, t: string) => { map[p] = t },
        remove: async (p: string) => { delete map[p] },
      },
    }
  }

  it('does not clobber a write made while load() was in flight', async () => {
    const idb = gated({ '/home/guest/notes.txt': 'old' })
    const fs = new FileStore(idb.adapter, '/home/guest')

    const loading = fs.load()                        // boot(): await files.load()
    expect(fs.read('~/notes.txt')).toBeNull()        // the prompt is already live
    expect(fs.write('~/notes.txt', 'new').ok).toBe(true)
    idb.release()
    await loading

    expect(idb.map['/home/guest/notes.txt']).toBe('new') // storage took the save
    expect(fs.read('~/notes.txt')).toBe('new')           // memory must agree
  })
})

describe('what the store accepts', () => {
  it('refuses to make the home root itself a file', () => {
    const fs = store()
    const r = fs.write('~', 'ghost')
    expect(r.ok).toBe(false)
    // Whatever it accepted, `ls ~` can never show it: list()'s base is
    // '/home/guest/' and the key is '/home/guest'.
    expect(fs.list()).toEqual([])
    expect(fs.bytes).toBe(0)
  })

  it('ignores stored keys from outside the writable root', async () => {
    const fs = new FileStore(createMemoryAdapter({ '/home/olduser/x': 'ghost' }), '/home/guest')
    await fs.load()
    // Counted by df, copied into python by copyIn, invisible to ls, and `rm`
    // refuses it because resolve() says it is read-only.
    expect(fs.entries()).toEqual([])
    expect(fs.bytes).toBe(0)
  })
})
