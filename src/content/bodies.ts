import type { DocBody } from '../types.js'
import loaders from 'virtual:proseos/bodies'

/**
 * The prose, one chunk at a time.
 *
 * The listing ships in the entry bundle; the documents do not. Opening one
 * fetches that one, which is what keeps a long archive from being a long
 * download — the cost of a post is paid by the reader who opens it.
 */
const cache = new Map<string, DocBody>()
let texts: Record<string, string> | null = null

/** The body if it is already here, which is what lets the reader open in one frame. */
export const peekBody = (slug: string): DocBody | null => cache.get(slug) ?? null

export async function loadBody(slug: string): Promise<DocBody | null> {
  const have = cache.get(slug)
  if (have) return have
  const load = loaders[slug]
  if (!load) return null
  const body = (await load()).default
  cache.set(slug, body)
  return body
}

/**
 * Take a body the build already put in the page.
 *
 * A post opened by its own URL arrives with its prose prerendered in the HTML,
 * so fetching the chunk that says the same thing would be a second download of
 * something already on screen.
 */
export function seedBody(slug: string, body: DocBody): void {
  if (!cache.has(slug)) cache.set(slug, body)
}

/** Start the fetch without waiting for it — used when a post is selected. */
export function warmBody(slug: string): void {
  if (!cache.has(slug)) void loadBody(slug)
}

/** Every document's plain text. One chunk, loaded the first time anything searches. */
export async function loadText(): Promise<Record<string, string>> {
  texts ??= (await import('virtual:proseos/text')).default
  return texts
}
