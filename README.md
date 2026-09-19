# xqy2006's blog

Runs on [ProseOS](https://github.com/xqy2006/proseos): a static blog whose
reading interface is a simulated shell. Posts are Markdown in `content/posts/`;
the build renders them to HTML at build time, so every article is a real page
that reads fine with JavaScript off.

Migrated from VuePress + vuepress-theme-plume. **Every article kept the URL it
was published under** — `/article/<id>/` is still the canonical address of each
post, it is what the sitemap lists, and nothing that was linked or indexed has
moved. The same post also answers to `/posts/<id>/`, which points back at the
permalink as canonical.

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
sitemap and feed name) and `base`.

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
