# xqy2006's blog

Runs on [ProseOS](https://github.com/xqy2006/proseos): a static blog whose
reading interface is a simulated shell. Posts are Markdown in `content/posts/`;
the build renders them to HTML at build time, so every article is a real page
that reads fine with JavaScript off.

Migrated from VuePress + vuepress-theme-plume. `/article/<id>/` is the
permalink of every article, as it has always been; a post also answers to
`/posts/<id>/`, which names the permalink as canonical.

## Writing

```sh
npm install
npm run dev            # http://localhost:5173
npm run build          # -> dist/
npm run preview
```

A post is a Markdown file in `content/posts/` with front matter:

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

## Deploying

`vercel.json` builds with `npm run build` into `dist/`, which is what serves
blog.xuqinyang.top. `.github/workflows/main.yml` builds the same output and
pushes it to the `gh-pages` branch for xqy2006.github.io. Both serve identical
paths, so a link works on either.

`site.config.ts` holds the title, the shell prompt, `origin` (the host the
sitemap and feed name), `base` and the "powered by" line.

## Tracking ProseOS

ProseOS is vendored here rather than installed, so that Vercel and Actions
build straight from this repository and never need credentials for another
one. Updating is a copy:

```sh
node scripts/sync-framework.mjs ../proseos
npm run build     # says whether site.config.ts still satisfies SiteConfig
```

`src/`, `build/`, `tests/`, `index.html`, the vite and tsconfig files and the
fonts are replaced wholesale. `content/`, `site.config.ts` and everything else
in `public/` are never touched.

`.github/workflows/sync-framework.yml` does the same on demand and opens a
pull request with the result, having run the build and the tests first. It
needs a `PROSEOS_TOKEN` secret while ProseOS is private. To have it fire on
every ProseOS commit rather than by hand, add a step to ProseOS's own workflow:

```yaml
- run: gh api repos/xqy2006/xqy2006.github.io/dispatches -f event_type=proseos-updated
  env:
    GH_TOKEN: ${{ secrets.BLOG_TOKEN }}
```

Nothing here is live: a static site is rebuilt, not reloaded. This is as close
as it gets — a ProseOS commit, a pull request a minute later, and a deploy when
it is merged.

## Large downloads

Five files are linked from posts at root paths (`/ez_jsc.zip` and friends).
They moved from `docs/.vuepress/public/` to `public/` with the rest, so the
links still resolve and the repository still carries about 200 MB of them. A
shallow clone is kinder:

```sh
git clone --filter=blob:none https://github.com/xqy2006/xqy2006.github.io.git
```

## Layout

```
content/posts/     the articles
content/pages/     about, links
public/img/        images, at the paths the posts link
src/ build/        ProseOS, vendored
site.config.ts     title, host, origin, theme
```
