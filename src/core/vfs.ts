import type { Doc, Manifest } from '../types.js'

export interface VNode {
  name: string
  path: string
  kind: 'dir' | 'file'
  children?: Map<string, VNode>
  doc?: Doc
  /** Size in bytes-ish, for `ls -l`. Derived from word count. */
  size?: number
  mtime?: string
}

/** Posts and pages projected onto a read-only filesystem, so `ls`/`cd`/`cat` are real. */
export class Vfs {
  readonly root: VNode
  private byslug = new Map<string, Doc>()
  cwd = '/'

  constructor(manifest: Manifest) {
    this.root = { name: '', path: '/', kind: 'dir', children: new Map() }
    for (const p of manifest.posts) this.add(p)
    for (const p of manifest.pages) this.add(p)
  }

  private add(doc: Doc) {
    this.byslug.set(doc.slug, doc)
    const parts = doc.path.split('/').filter(Boolean)
    let node = this.root
    for (let i = 0; i < parts.length - 1; i++) {
      const name = parts[i]
      let next = node.children!.get(name)
      if (!next) {
        next = { name, path: node.path === '/' ? `/${name}` : `${node.path}/${name}`, kind: 'dir', children: new Map() }
        node.children!.set(name, next)
      }
      node = next
    }
    const file = parts[parts.length - 1]
    node.children!.set(file, {
      name: file,
      path: doc.path,
      kind: 'file',
      doc,
      size: doc.bytes,
      mtime: doc.date,
    })
  }

  /** Resolve `p` against cwd, collapsing `.`/`..`. Returns an absolute path. */
  normalize(p: string): string {
    const from = p.startsWith('/') ? [] : this.cwd.split('/').filter(Boolean)
    for (const seg of p.split('/')) {
      if (!seg || seg === '.') continue
      if (seg === '..') from.pop()
      else from.push(seg)
    }
    return '/' + from.join('/')
  }

  get(p: string): VNode | null {
    const abs = this.normalize(p)
    if (abs === '/') return this.root
    let node: VNode = this.root
    for (const seg of abs.split('/').filter(Boolean)) {
      const next = node.children?.get(seg)
      if (!next) return null
      node = next
    }
    return node
  }

  list(p = '.'): VNode[] | null {
    const node = this.get(p)
    if (!node) return null
    if (node.kind === 'file') return [node]
    return [...node.children!.values()].sort((a, b) =>
      a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1)
  }

  chdir(p: string): { ok: true } | { ok: false; error: string } {
    const abs = this.normalize(p)
    const node = this.get(abs)
    if (!node) return { ok: false, error: `no such file or directory: ${p}` }
    if (node.kind !== 'dir') return { ok: false, error: `not a directory: ${p}` }
    this.cwd = abs
    return { ok: true }
  }

  /** Find a document by slug, by path, or by a unique filename fragment. */
  resolveDoc(ref: string): Doc | null {
    if (this.byslug.has(ref)) return this.byslug.get(ref)!
    const direct = this.get(ref)
    if (direct?.doc) return direct.doc
    const stripped = ref.replace(/\.md$/, '')
    if (this.byslug.has(stripped)) return this.byslug.get(stripped)!
    const hits = [...this.byslug.values()].filter((d) => d.slug.includes(stripped))
    return hits.length === 1 ? hits[0] : null
  }

  docs(): Doc[] { return [...this.byslug.values()] }

  /** Every path in the tree, for tab completion. */
  paths(): string[] {
    const out: string[] = []
    const walk = (n: VNode) => {
      out.push(n.path)
      n.children?.forEach(walk)
    }
    walk(this.root)
    return out.sort()
  }
}
