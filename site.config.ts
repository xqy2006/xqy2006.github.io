export interface SiteConfig {
  title: string
  host: string
  user: string
  description: string
  /**
   * Where the site is served from, scheme and host, no trailing slash.
   * The sitemap and the feed need absolute URLs; leave it empty and they fall
   * back to site-relative ones, which crawlers are entitled to reject.
   */
  origin: string
  base: string
  lang: string
  defaultTheme: string
  /** Posts shown per page in every listing. Fixed, so a page number is stable. */
  postsPerPage: number
  media: { mode: 'hybrid' | 'real' | 'ascii'; colors: 16 | 256 | 'true'; columns: number }
  ligatures: boolean
  /** Python is loaded from a CDN on first use, never at boot. */
  python: { version: string; cdn: string }
}

export const site: SiteConfig = {
  title: "xqy2006's blog",
  host: 'xuqinyang',
  user: 'xqy2006',
  description: "xqy2006's blog",
  // The address the articles were indexed under. Both hosts serve the same
  // paths; this is the one the sitemap and the feed should name.
  origin: 'https://blog.xuqinyang.top',
  base: '/',
  lang: 'zh',
  defaultTheme: 'anthropic',
  postsPerPage: 8,
  media: { mode: 'hybrid', colors: 16, columns: 72 },
  ligatures: false,
  python: {
    version: '0.29.5',
    cdn: 'https://cdn.jsdelivr.net/pyodide',
  },
}

export default site
