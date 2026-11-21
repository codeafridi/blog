import assert from 'node:assert/strict'
import { test } from 'node:test'
import { escapeXML, humanDate, readingTime, rss, slugify } from '../lib/site.mjs'

test('slugify keeps it readable', () => {
  assert.equal(slugify('A failed rename is not a reorder', '2026-11-21'), '2026-11-21-a-failed-rename-is-not-a-reorder')
  assert.equal(slugify('  C++ & Rust!  '), 'c-rust')
})

test('reading time', () => {
  assert.equal(readingTime('one two three'), 1)
  assert.equal(readingTime('word '.repeat(440)), 2)
  assert.equal(readingTime(''), 1)
})

test('rss escapes and links', () => {
  const feed = rss({
    site: { title: 'notes', url: 'https://example.com', description: 'a <b>description</b>' },
    posts: [
      {
        title: 'Rename & retry',
        slug: '2026-11-21-rename',
        date: '2026-11-21',
        summary: 'A <script> tag & more',
      },
    ],
  })

  assert.match(feed, /<title>Rename &amp; retry<\/title>/)
  assert.match(feed, /<link>https:\/\/example.com\/2026-11-21-rename.html<\/link>/)
  assert.match(feed, /A &lt;script&gt; tag &amp; more/)
  assert.ok(!feed.includes('<script>'))
  assert.match(feed, /a &lt;b&gt;description&lt;\/b&gt;/)
})

test('escapeXML covers quotes', () => {
  assert.equal(escapeXML(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;')
})

test('humanDate is stable across timezones', () => {
  assert.equal(humanDate('2026-11-21'), '21 November 2026')
})
