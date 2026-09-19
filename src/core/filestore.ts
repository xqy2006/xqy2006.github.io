/**
 * The writable half of the filesystem.
 *
 * `Vfs` projects the content manifest and is read-only; this holds what the
 * reader creates — scripts, notes, whatever Python writes — under a single
 * home directory. The two are kept apart deliberately: one is your posts, the
 * other is scratch space, and conflating them would put `rm` within reach of
 * the blog.
 *
 * Contents live in memory so `ls` and `cat` stay synchronous, and are
 * persisted behind them. IndexedDB rather than localStorage: a few scripts and
 * a pip cache go past five megabytes quickly, and localStorage blocks the main
 * thread on every write.
 */

export interface StorageAdapter {
  load(): Promise<Record<string, string>>
  put(path: string, text: string): Promise<void>
  remove(path: string): Promise<void>
}

/** Total bytes allowed; past this, writing fails loudly rather than silently. */
export const STORE_LIMIT = 2 * 1024 * 1024

export function createMemoryAdapter(seed: Record<string, string> = {}): StorageAdapter {
  const map = { ...seed }
  return {
    load: async () => ({ ...map }),
    put: async (p, t) => { map[p] = t },
    remove: async (p) => { delete map[p] },
  }
}

export function createIdbAdapter(dbName = 'proseos', storeName = 'files'): StorageAdapter {
  let dbPromise: Promise<IDBDatabase> | null = null

  const open = (): Promise<IDBDatabase> => (dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(storeName) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }))

  const tx = async <T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open()
    return new Promise<T>((resolve, reject) => {
      const t = db.transaction(storeName, mode)
      const req = run(t.objectStore(storeName))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }

  return {
    async load() {
      try {
        const db = await open()
        // One cursor in one transaction: reading keys and values in two
        // separate transactions lets a write land between them, after which
        // the two lists no longer line up and content is paired with the
        // wrong filename.
        return await new Promise<Record<string, string>>((resolve, reject) => {
          const out: Record<string, string> = {}
          const req = db.transaction(storeName, 'readonly').objectStore(storeName).openCursor()
          req.onsuccess = () => {
            const cursor = req.result
            if (!cursor) { resolve(out); return }
            out[String(cursor.key)] = String(cursor.value ?? '')
            cursor.continue()
          }
          req.onerror = () => reject(req.error)
        })
      } catch {
        return {} // private mode, blocked storage: the shell still works
      }
    },
    async put(path, text) {
      try { await tx('readwrite', (s) => s.put(text, path)) } catch { /* not persisted */ }
    },
    async remove(path) {
      try { await tx('readwrite', (s) => s.delete(path)) } catch { /* not persisted */ }
    },
  }
}

export class FileStore {
  readonly root: string
  private files = new Map<string, string>()
  private adapter: StorageAdapter
  private loaded = false

  constructor(adapter: StorageAdapter, root = '/home/guest') {
    this.adapter = adapter
    this.root = root.replace(/\/$/, '')
  }

  async load(): Promise<void> {
    if (this.loaded) return
    const stored = await this.adapter.load()
    for (const [p, t] of Object.entries(stored)) {
      // Anything written while this was in flight is newer than what was on
      // disk, so it wins. And keys from another user's home — `site.user` is
      // a knob — are not ours to count, list or hand to Python.
      if (this.files.has(p) || !this.owns(p)) continue
      this.files.set(p, t)
    }
    this.loaded = true
  }

  /** Expand `~`, make absolute against the home directory, collapse `.`/`..`. */
  normalize(path: string, cwd = this.root): string {
    let p = path.trim()
    if (p === '~') p = this.root
    else if (p.startsWith('~/')) p = this.root + p.slice(1)
    const parts = (p.startsWith('/') ? p : `${cwd}/${p}`).split('/')
    const out: string[] = []
    for (const seg of parts) {
      if (!seg || seg === '.') continue
      if (seg === '..') out.pop()
      else out.push(seg)
    }
    return '/' + out.join('/')
  }

  /** True when the path belongs to the writable tree at all. */
  owns(path: string): boolean {
    const p = path.startsWith('/') ? path : this.normalize(path)
    return p === this.root || p.startsWith(this.root + '/')
  }

  has(path: string): boolean { return this.files.has(this.normalize(path)) }
  read(path: string): string | null { return this.files.get(this.normalize(path)) ?? null }

  get bytes(): number {
    let n = 0
    for (const [p, t] of this.files) n += p.length + t.length
    return n
  }

  write(path: string, text: string): { ok: true } | { ok: false; error: string } {
    const p = this.normalize(path)
    if (!this.owns(p)) return { ok: false, error: `${path}: read-only (only ${this.root} is writable)` }
    if (p === this.root) return { ok: false, error: `${path}: is a directory` }
    const existing = this.files.get(p)
    const freed = existing === undefined ? 0 : p.length + existing.length
    if (this.bytes - freed + p.length + text.length > STORE_LIMIT) {
      return { ok: false, error: `${path}: out of space (${Math.round(STORE_LIMIT / 1024)} KB limit)` }
    }
    this.files.set(p, text)
    void this.adapter.put(p, text)
    return { ok: true }
  }

  remove(path: string): boolean {
    const p = this.normalize(path)
    if (!this.files.delete(p)) return false
    void this.adapter.remove(p)
    return true
  }

  /** Immediate children of a directory: files as names, subdirectories with a slash. */
  list(dir = this.root): { name: string; kind: 'file' | 'dir' }[] {
    const base = this.normalize(dir).replace(/\/$/, '') + '/'
    const seen = new Map<string, 'file' | 'dir'>()
    for (const p of this.files.keys()) {
      if (!p.startsWith(base)) continue
      const rest = p.slice(base.length)
      const slash = rest.indexOf('/')
      if (slash === -1) seen.set(rest, 'file')
      else seen.set(rest.slice(0, slash), 'dir')
    }
    return [...seen.entries()]
      .map(([name, kind]) => ({ name, kind }))
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1))
  }

  /** Every file, for copying into a Python filesystem. */
  entries(): [string, string][] { return [...this.files.entries()] }
}
