# xqy2006's blog

The articles, and nothing else. The site is built by
[ProseOS](https://github.com/xqy2006/proseos) — a static blog whose reading
interface is a simulated shell — which is fetched at build time rather than
committed, because that repository is private and this one is not.

`/article/<id>/` is the permalink of every article; a post also answers to
`/posts/<id>/`, which names the permalink as canonical.

## Writing

```sh
npm install
npm run framework ../proseos    # or: PROSEOS_TOKEN=… npm run framework
npm run dev                     # http://localhost:5173
npm run build                   # -> dist/
```

The framework step writes `src/`, `build/`, `index.html`, the vite and tsconfig
files and the fonts into the working tree. All of it is gitignored. Run it
again whenever ProseOS changes; `npm run build` then says whether
`site.config.ts` still satisfies `SiteConfig`, and the script reports any
dependency the framework has moved on from.

A post is a Markdown file in `content/posts/`:

```yaml
---
title: "标题"
date: 2026-02-27
tags: [python, reverse]
lang: zh
permalink: /article/uaoyy6mu/   # only for posts that had one already
---
```

`permalink` is what keeps an old address working. New posts do not need it —
leave it out and the post lives at `/posts/<filename>/`.

Images go in `public/` and are linked from the site root: `![x](/img/…)`.

## What is in this repository

```
content/posts/     the articles
content/pages/     about, links
public/img/        images, at the paths the posts link
public/*.zip|exe   the large downloads posts link to
site.config.ts     title, host, origin, theme
scripts/           the framework fetcher
```

Nothing here is ProseOS. `dist/` is built output with no source maps, so a
deploy publishes the site and not the framework.

## Deploying

Both hosts build the same way and serve identical paths, so a link works on
either:

- **Vercel** → blog.xuqinyang.top. `vercel.json` runs the fetcher and then the
  build. Set `PROSEOS_TOKEN` as an environment variable in the project.
- **GitHub Pages** → xqy2006.github.io, via `.github/workflows/main.yml`, which
  pushes `dist/` to `gh-pages`. Needs the same token as a repository secret.

To rebuild the site whenever ProseOS changes rather than only on a commit here,
add a step to ProseOS's own workflow:

```yaml
- run: gh api repos/xqy2006/xqy2006.github.io/dispatches -f event_type=proseos-updated
  env:
    GH_TOKEN: ${{ secrets.BLOG_TOKEN }}
```

A static site is rebuilt, not reloaded, so that is as close to live as it gets:
a ProseOS commit, a build a minute later, a deploy when it finishes.

## Large downloads

Five files are linked from posts at root paths (`/ez_jsc.zip` and friends) and
make up most of the repository's size. A shallow clone is kinder:

```sh
git clone --filter=blob:none https://github.com/xqy2006/xqy2006.github.io.git
```
