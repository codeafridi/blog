import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = fileURLToPath(new URL('..', import.meta.url))

async function build() {
  const out = await mkdtemp(join(tmpdir(), 'blog-build-'))
  await run('node', ['build.mjs'], {
    cwd: root,
    env: { ...process.env, OUT_DIR: out, SITE_URL: 'https://example.com' },
  })
  return out
}

test('build writes every page the site needs', async () => {
  const out = await build()
  try {
    for (const file of ['index.html', 'about.html', '404.html', 'feed.xml', 'theme.css', 'favicon.svg']) {
      const info = await stat(join(out, file))
      assert.ok(info.size > 0, `${file} is empty`)
    }

    const posts = (await import('node:fs/promises')).readdir(out)
    const files = await posts
    const html = files.filter((f) => f.endsWith('.html') && !['index.html', 'about.html', '404.html'].includes(f))
    assert.equal(html.length, 3, `expected 3 post pages, got ${html.join(', ')}`)

    const index = await readFile(join(out, 'index.html'), 'utf8')
    assert.equal((index.match(/<article class="entry">/g) ?? []).length, 3)
    assert.match(index, /<div class="entry-no">01<span>/)
    assert.match(index, /aria-current="page"/)
    assert.ok(!/\{\{|\}\}/.test(index), 'template placeholder left behind')

    const feed = await readFile(join(out, 'feed.xml'), 'utf8')
    assert.match(feed, /^<\?xml version="1.0" encoding="utf-8"\?>/)
    assert.match(feed, /<link>https:\/\/example.com\/2026-11-21-/)
    assert.ok(!feed.includes('<script>'))

    const postFile = files.find((f) => f.startsWith('2026-11-21'))
    const post = await readFile(join(out, postFile), 'utf8')
    assert.match(post, /<title>A failed rename is not a reorder — codeafridi<\/title>/)
    assert.match(post, /<h2>The one word<\/h2>/, 'markdown headings must render')
    assert.match(post, /<pre><code class="language-cpp">/, 'code fence keeps its language')
    assert.match(post, /rel="canonical" href="https:\/\/example.com\//)
  } finally {
    await rm(out, { recursive: true, force: true })
  }
})
