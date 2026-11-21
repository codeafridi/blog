#!/usr/bin/env node
/**
 * Static blog generator: Markdown in content/, HTML in dist/.
 *
 *   node build.mjs            # build
 *   node build.mjs --serve    # build, then serve dist/ on :4321
 *
 * No dependencies. The only input is content/*.md with front matter; the only
 * output is plain files that any host can serve.
 */
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { frontMatter, render } from './lib/markdown.mjs'
import { escapeXML, humanDate, isoDate, readingTime, rss, slugify } from './lib/site.mjs'

const ROOT = fileURLToPath(new URL('.', import.meta.url))
const CONTENT = join(ROOT, 'content')
const OUT = process.env.OUT_DIR ? resolve(process.env.OUT_DIR) : join(ROOT, 'dist')
const SERVE = process.argv.includes('--serve')
const PORT = Number(process.env.PORT ?? 4321)

export const SITE = {
  title: 'codeafridi',
  description: 'Notes on systems, tools, and the bugs worth writing down.',
  url: (process.env.SITE_URL ?? `http://localhost:${PORT}`).replace(/\/$/, ''),
  author: 'codeafridi',
}

const nav = [
  ['writing', 'index.html'],
  ['about', 'about.html'],
  ['rss', 'feed.xml'],
]

function layout({ title, description, body, path, current = 'index.html' }) {
  const pageTitle = title === SITE.title ? title : `${title} — ${SITE.title}`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeXML(pageTitle)}</title>
<meta name="description" content="${escapeXML(description)}">
<link rel="stylesheet" href="theme.css">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${escapeXML(SITE.title)}" href="feed.xml">
${path ? `<link rel="canonical" href="${SITE.url}${path === 'index.html' ? '/' : '/' + path}">` : ''}
</head>
<body>
<header class="masthead">
  <a class="wordmark" href="index.html">${escapeXML(SITE.title)}</a>
  <nav>${nav
    .map(([label, href]) =>
      `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`,
    )
    .join('')}</nav>
</header>
<main>
${body}
</main>
<footer class="colophon">
  <span>© ${new Date().getUTCFullYear()} ${escapeXML(SITE.author)}</span>
  <span>Set in Newsreader &amp; IBM Plex Mono · <a href="feed.xml">RSS</a></span>
</footer>
</body>
</html>
`
}

const marginDate = (d) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })

function indexPage(posts) {
  const items = posts
    .map(
      (p, i) => `  <article class="entry">
    <div class="entry-no">${String(i + 1).padStart(2, '0')}<span>${marginDate(p.date)}</span></div>
    <div>
      <h2><a href="${p.slug}.html">${escapeXML(p.title)}</a></h2>
      <p class="summary">${escapeXML(p.summary)}</p>
      <div class="entry-meta">
        <span>${p.minutes} min read</span>
        ${p.tags.map((t) => `<span>${escapeXML(t)}</span>`).join('')}
      </div>
    </div>
  </article>`,
    )
    .join('\n')

  return layout({
    title: SITE.title,
    description: SITE.description,
    path: 'index.html',
    body: `<section class="intro">
  <h1>Writing</h1>
  <p class="lede">${escapeXML(SITE.description)}</p>
</section>
<section class="entries">
${items}
</section>`,
  })
}

function postPage(post, prev, next, number) {
  const tags = post.tags.length
    ? `<p class="tags">${post.tags.map((t) => `<span>${escapeXML(t)}</span>`).join('')}</p>`
    : ''

  const step = (p, label) =>
    p
      ? `<a class="step" href="${p.slug}.html"><span class="label">${label}</span><span>${escapeXML(p.title)}</span></a>`
      : '<span></span>'

  return layout({
    title: post.title,
    description: post.summary,
    path: `${post.slug}.html`,
    body: `<article class="post">
  <header>
    <div class="entry-meta"><span>Entry ${number}</span><time datetime="${isoDate(post.date)}">${humanDate(post.date)}</time><span>${post.minutes} min read</span></div>
    <h1>${escapeXML(post.title)}</h1>
    <p class="summary">${escapeXML(post.summary)}</p>
    ${tags}
  </header>
  <div class="prose">
${post.html}
  </div>
  <nav class="pager">
    ${step(prev, 'Previous')}
    ${step(next, 'Next')}
  </nav>
</article>`,
  })
}

function aboutPage(markdown) {
  return layout({
    title: 'About',
    description: `About ${SITE.author}`,
    path: 'about.html',
    current: 'about.html',
    body: `<article class="post">
  <header><h1>About</h1></header>
  <div class="prose">
${render(markdown)}
  </div>
</article>`,
  })
}

function notFoundPage() {
  return layout({
    title: 'Not found',
    description: 'Nothing here.',
    body: `<section class="intro">
  <h1>Nothing here</h1>
  <p class="lede">That page does not exist. <a href="index.html">Start from the writing.</a></p>
</section>`,
  })
}

async function loadPosts() {
  const files = (await readdir(CONTENT)).filter((f) => f.endsWith('.md'))
  const posts = []

  for (const file of files) {
    if (file === 'about.md') continue
    const raw = await readFile(join(CONTENT, file), 'utf8')
    const { data, body } = frontMatter(raw)

    if (!data.title) throw new Error(`${file}: missing "title" in front matter`)
    if (!data.date) throw new Error(`${file}: missing "date" in front matter`)
    if (!data.summary) throw new Error(`${file}: missing "summary" in front matter`)

    posts.push({
      file,
      title: data.title,
      date: data.date,
      summary: data.summary,
      tags: data.tags ?? [],
      slug: slugify(data.title, data.date),
      html: render(body),
      minutes: readingTime(body),
    })
  }

  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return posts
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#fbf9f2"/><path d="M8 24V8h8.5a5 5 0 0 1 0 10H12v6" fill="none" stroke="#1b1a17" stroke-width="2.2"/><circle cx="23" cy="23" r="2.2" fill="#a2432c"/></svg>
`

async function build() {
  const posts = await loadPosts()
  await rm(OUT, { recursive: true, force: true })
  await mkdir(join(OUT, 'fonts'), { recursive: true })

  await writeFile(join(OUT, 'index.html'), indexPage(posts))
  await writeFile(join(OUT, '404.html'), notFoundPage())
  await writeFile(join(OUT, 'feed.xml'), rss({ site: SITE, posts }))
  await writeFile(join(OUT, 'favicon.svg'), favicon)

  for (const [i, post] of posts.entries()) {
    const prev = posts[i + 1] ?? null
    const next = posts[i - 1] ?? null
    const number = String(i + 1).padStart(2, '0')
    await writeFile(join(OUT, `${post.slug}.html`), postPage(post, prev, next, number))
  }

  const about = await readFile(join(CONTENT, 'about.md'), 'utf8').catch(() => null)
  if (about) {
    const { body } = frontMatter(about)
    await writeFile(join(OUT, 'about.html'), aboutPage(body))
  }

  await cp(join(ROOT, 'theme.css'), join(OUT, 'theme.css'))
  await cp(join(ROOT, 'assets', 'fonts'), join(OUT, 'fonts'), { recursive: true })

  return posts
}

function serve() {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
  }
  createServer(async (req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0])
    const file = url === '/' ? 'index.html' : url.slice(1)
    try {
      const data = await readFile(join(OUT, file))
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
      res.end(data)
    } catch {
      const body = await readFile(join(OUT, '404.html')).catch(() => 'not found')
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
      res.end(body)
    }
  }).listen(PORT, () => {
    console.log(`serving ${OUT} on http://localhost:${PORT}`)
  })
}

const posts = await build()
console.log(`built ${posts.length} posts into ${OUT}`)
for (const p of posts) console.log(`  ${p.slug}.html`)

if (SERVE) serve()
