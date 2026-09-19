import type { SiteConfig } from './src/config.js'

export type { SiteConfig }

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
  // No ceiling: a tall window shows as many posts as it can hold.
  postsPerPage: 'auto',
  media: { mode: 'hybrid', colors: 16, columns: 72 },
  ligatures: false,
  // Plain text, not a link: proseos is a private repository, so a link would
  // 404 for everyone but me. Fill in the URL once it is public.
  credit: { show: true, url: '' },
  python: {
    version: '0.29.5',
    cdn: 'https://cdn.jsdelivr.net/pyodide',
  },
}

export default site
