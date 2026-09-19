import site from '../../site.config.js'
import type { FileStore } from '../core/filestore.js'
import type { Doc } from '../types.js'

/**
 * Python, loaded on demand.
 *
 * Pyodide is several megabytes; a reader who came to read a post must never
 * pay for it. Nothing here runs until someone types `python` or `pip`, the
 * load is memoized, and the browser caches it for next time.
 *
 * The filesystem is copied, not bridged: posts are written in once, the home
 * directory is copied in before a run and copied back after. A live-mounted
 * backend would be cleverer and would have to be debugged.
 */

export interface PyodideApi {
  runPythonAsync(code: string): Promise<unknown>
  setStdout(opts: { batched: (s: string) => void }): void
  setStderr(opts: { batched: (s: string) => void }): void
  FS: {
    writeFile(path: string, data: string, opts?: { encoding: string }): void
    readFile(path: string, opts: { encoding: string }): string
    mkdirTree(path: string): void
    readdir(path: string): string[]
    stat(path: string): { mode: number }
    isDir(mode: number): boolean
    unlink(path: string): void
  }
}

declare global {
  interface Window { loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideApi> }
}

let pending: Promise<PyodideApi> | null = null
let ready: PyodideApi | null = null

export const isReady = (): boolean => ready !== null
export const pythonVersion = (): string => site.python.version

function inject(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tag = document.createElement('script')
    tag.src = src
    tag.onload = () => resolve()
    tag.onerror = () => reject(new Error(`could not load ${src}`))
    document.head.appendChild(tag)
  })
}

/** Memoized: the second caller waits on the first rather than loading again. */
export function loadPython(): Promise<PyodideApi> {
  if (ready) return Promise.resolve(ready)
  return (pending ??= (async () => {
    const base = `${site.python.cdn}/v${site.python.version}/full`
    // Already present (a previous load, or a test harness): do not fetch again.
    if (!window.loadPyodide) await inject(`${base}/pyodide.js`)
    if (!window.loadPyodide) throw new Error('pyodide loaded but did not register loadPyodide')
    const api = await window.loadPyodide({ indexURL: `${base}/` })
    ready = api
    return api
  })().catch((err) => { pending = null; throw err }))
}

const DOC_ROOT = '/posts'

/**
 * Point the interpreter at the tree we mount.
 *
 * Pyodide starts in `/home/pyodide`. Left alone, `open('out.txt','w')` writes
 * somewhere nothing ever looks and `import mymod` cannot see a module `ls ~`
 * lists — both silently, which is worse than failing.
 */
export async function prepare(py: PyodideApi, root: string): Promise<void> {
  const r = JSON.stringify(root)
  await py.runPythonAsync(
    'import os, sys\n' +
    `os.makedirs(${r}, exist_ok=True)\n` +
    `os.chdir(${r})\n` +
    `if ${r} not in sys.path:\n` +
    `    sys.path.insert(0, ${r})\n`,
  )
}

function ensureDir(py: PyodideApi, path: string): void {
  const dir = path.slice(0, path.lastIndexOf('/'))
  if (dir) py.FS.mkdirTree(dir)
}

/** Posts, written once so Python can read the blog it lives in. */
export function mountDocs(py: PyodideApi, docs: Doc[], text: Record<string, string>): void {
  py.FS.mkdirTree(DOC_ROOT)
  for (const doc of docs) {
    const path = `${DOC_ROOT}/${doc.slug}.md`
    ensureDir(py, path)
    py.FS.writeFile(path, text[doc.slug] ?? '', { encoding: 'utf8' })
  }
}

/** Every regular file under `dir`, depth first. */
function listFiles(py: PyodideApi, dir: string): string[] {
  const out: string[] = []
  const walk = (d: string): void => {
    let names: string[]
    try { names = py.FS.readdir(d) } catch { return }
    for (const name of names) {
      if (name === '.' || name === '..') continue
      const path = `${d}/${name}`.replace(/\/+/g, '/')
      try {
        if (py.FS.isDir(py.FS.stat(path).mode)) walk(path)
        else out.push(path)
      } catch {
        // Not a readable regular file — a socket, say. Skip it rather than
        // abandoning the rest of the tree.
      }
    }
  }
  walk(dir)
  return out
}

/**
 * Copy the writable tree in before a run.
 *
 * Deletions travel too. The Pyodide filesystem lives as long as the tab, so
 * a file removed in the shell would otherwise still be sitting there and
 * would be copied straight back out again on the next run — `rm` undone by
 * the next `python`.
 */
export function copyIn(py: PyodideApi, files: FileStore): void {
  py.FS.mkdirTree(files.root)
  const wanted = new Map(files.entries())
  for (const path of listFiles(py, files.root)) {
    if (!wanted.has(path)) py.FS.unlink(path)
  }
  for (const [path, text] of wanted) {
    ensureDir(py, path)
    py.FS.writeFile(path, text, { encoding: 'utf8' })
  }
}

export interface SyncResult {
  /** Files the run created or changed, already in the store. */
  changed: string[]
  /** Files the run deleted, now gone from the store too. */
  removed: string[]
  /** Files that would not fit. Reported, never swallowed. */
  failed: string[]
}

/**
 * Copy the writable tree back after a run, so a script that writes a file
 * leaves it where `ls ~` and `edit` can see it — and one that deletes a file
 * really deletes it.
 */
export function copyOut(py: PyodideApi, files: FileStore): SyncResult {
  const changed: string[] = []
  const failed: string[] = []
  const present = new Set<string>()

  for (const path of listFiles(py, files.root)) {
    present.add(path)
    let text: string
    try { text = py.FS.readFile(path, { encoding: 'utf8' }) } catch { continue }
    if (files.read(path) === text) continue
    const written = files.write(path, text)
    if (written.ok) changed.push(path)
    else failed.push(`${path}: ${written.error}`)
  }

  const removed: string[] = []
  for (const [path] of files.entries()) {
    if (present.has(path)) continue
    files.remove(path)
    removed.push(path)
  }

  return { changed, removed, failed }
}

export interface RunResult extends SyncResult {
  lines: string[]
  error?: string
}

/**
 * Run code with the writable tree copied in and back out again.
 *
 * Output is collected rather than streamed: a blog shell runs short scripts,
 * and collecting keeps the caller free to render the result wherever it likes
 * — the transcript, or the REPL's own log.
 */
export async function execute(py: PyodideApi, files: FileStore, code: string): Promise<RunResult> {
  const lines: string[] = []
  const collect = { batched: (s: string) => { for (const l of s.split('\n')) lines.push(l) } }
  py.setStdout(collect)
  py.setStderr(collect)
  copyIn(py, files)
  let error: string | undefined
  try {
    const value = await py.runPythonAsync(code)
    if (value !== undefined && value !== null) {
      lines.push(String(value))
    }
  } catch (err) {
    error = String(err instanceof Error ? err.message : err).trim()
  }
  const sync = copyOut(py, files)
  while (lines.length && lines[lines.length - 1] === '') lines.pop()
  return { lines, error, ...sync }
}
