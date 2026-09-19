/**
 * The shape of `site.config.ts`.
 *
 * It lives here, with the framework, so that a site tracking ProseOS picks up
 * new settings by updating `src/` — the config file at the root then only has
 * to supply values, not restate the type.
 */
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
  /**
   * Where the site is served from. `/` suits a user site or a custom domain;
   * a GitHub Pages project site lives under `/<repo>/`, which the deploy
   * workflow passes as PROSEOS_BASE so the config stays right for local work.
   */
  base: string
  lang: string
  defaultTheme: string
  /** Posts shown per page in every listing. Fixed, so a page number is stable. */
  postsPerPage: number
  media: { mode: 'hybrid' | 'real' | 'ascii'; colors: 16 | 256 | 'true'; columns: number }
  ligatures: boolean
  /**
   * A "powered by ProseOS" line under the listing. `url` is optional: without
   * one the notice is plain text, which is better than a link to a repository
   * a visitor cannot open.
   */
  credit: { show: boolean; url: string }
  /** Python is loaded from a CDN on first use, never at boot. */
  python: { version: string; cdn: string }
}
