export interface TocEntry { depth: number; text: string; id: string }

/**
 * What the listing knows about a document.
 *
 * Deliberately small: every one of these ships in the entry bundle, because
 * the blog, `ls`, `cal` and tag browsing all need every document at once. The
 * prose does not — see `DocBody`, which arrives one chunk at a time.
 */
export interface Doc {
  /** URL-safe id, also the argument to `open`. */
  slug: string
  title: string
  summary: string
  lang: string
  tags: string[]
  /** ISO date, empty for pages. */
  date: string
  /** Path inside the virtual filesystem, e.g. /posts/2026/foo.md */
  path: string
  /** The document's own URL, without the site base. */
  url: string
  /** Other URLs that resolve here — old permalinks, mostly. */
  aliases: string[]
  /** Size of the plain text, for `ls -l`, without shipping the text. */
  bytes: number
  words: number
  minutes: number
}

/** The prose. Loaded on demand, one chunk per document. */
export interface DocBody {
  /** Pre-rendered terminal-flavored HTML. */
  html: string
  toc: TocEntry[]
}

export interface Manifest {
  posts: Doc[]
  pages: Doc[]
  tags: Record<string, string[]>
  builtAt: string
}
