declare module 'virtual:proseos/content' {
  import type { Manifest } from './types'
  const manifest: Manifest
  export default manifest
}

/** One loader per document, each its own chunk. See src/content/bodies.ts. */
declare module 'virtual:proseos/bodies' {
  import type { DocBody } from './types'
  const loaders: Record<string, () => Promise<{ default: DocBody }>>
  export default loaders
}

/** Every document's plain text, in one chunk, for `find` and `grep`. */
declare module 'virtual:proseos/text' {
  const texts: Record<string, string>
  export default texts
}
