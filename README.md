# blog

A small static site for writing. Markdown in `content/`, plain HTML out, no
dependencies beyond Node itself.

```sh
node build.mjs           # build into dist/
node build.mjs --serve   # build and serve on http://localhost:4321
node --test              # 18 tests: markdown, front matter, feed
```

## Writing a post

Add `content/my-post.md`:

```markdown
---
title: A failed rename is not a reorder
date: 2026-11-21
summary: One sentence that appears on the index and in the feed.
tags: copyq, c++, testing
---

Body starts here.
```

`date`, `title` and `summary` are required — the build fails loudly without them.
The URL is derived from both: `2026-11-21-a-failed-rename-is-not-a-reorder.html`.

Headings in a post start at `##`; the page owns the `#`. Code fences, lists,
blockquotes, links, emphasis and inline code are supported. Everything is
escaped before formatting, so a post cannot inject markup by accident.

## How it works

- `lib/markdown.mjs` — the renderer. Escapes first, then applies only the
  constructs above. ~120 lines, no parser library.
- `lib/site.mjs` — slugs, reading time, dates, RSS.
- `build.mjs` — reads `content/`, writes `dist/`: index, post pages, about, 404,
  `feed.xml`, `theme.css`, fonts.
- `theme.css` — the design. Paper, one column, one accent, hairlines.

Fonts (Newsreader, IBM Plex Mono) are self-hosted under `assets/fonts`, so the
site makes no third-party requests.

## Deploying

`dist/` is static; any host works. For GitHub Pages, publish `dist/` from a
workflow (or run `node build.mjs` and push the output to `gh-pages`). Set
`SITE_URL=https://your.domain` when building so canonical links and the feed use
the real address.

## License

Code is MIT. The posts are mine; link to them, don't republish them.
