import assert from 'node:assert/strict'
import { test } from 'node:test'
import { frontMatter, inline, render } from '../lib/markdown.mjs'

test('escapes html before anything else', () => {
  const html = render('A <script>alert(1)</script> tag')
  assert.equal(html, '<p>A &lt;script&gt;alert(1)&lt;/script&gt; tag</p>')
})

test('headings shift below the page title', () => {
  assert.equal(render('# One'), '<h2>One</h2>')
  assert.equal(render('## Two'), '<h2>Two</h2>')
  assert.equal(render('### Three'), '<h3>Three</h3>')
  assert.equal(render('#### Four'), '<h4>Four</h4>')
})

test('paragraphs join wrapped lines and split on blank lines', () => {
  const html = render('first line\nsecond line\n\nnew paragraph')
  assert.equal(html, '<p>first line second line</p>\n<p>new paragraph</p>')
})

test('inline emphasis and code', () => {
  assert.equal(inline('a **bold** word'), 'a <strong>bold</strong> word')
  assert.equal(inline('an *italic* word'), 'an <em>italic</em> word')
  assert.equal(inline('a _dashed_ word'), 'a <em>dashed</em> word')
  assert.equal(inline('run `go test` now'), 'run <code>go test</code> now')
})

test('code spans are not formatted', () => {
  assert.equal(inline('`a * b`'), '<code>a * b</code>')
  assert.equal(inline('`<b>`'), '<code>&lt;b&gt;</code>')
})

test('links survive, unsafe schemes do not', () => {
  assert.equal(inline('[the post](https://example.com/x)'), '<a href="https://example.com/x">the post</a>')
  assert.equal(inline('[mail](mailto:a@b.c)'), '<a href="mailto:a@b.c">mail</a>')
  assert.equal(inline('[bad](javascript:alert(1))'), '[bad](javascript:alert(1))')
})

test('a fenced block keeps its content literal', () => {
  const html = render('```go\nfmt.Println("<hi>")\n```')
  assert.equal(html, '<pre><code class="language-go">fmt.Println(&quot;&lt;hi&gt;&quot;)</code></pre>')
})

test('unclosed fence still renders as code', () => {
  const html = render('```\nstill code')
  assert.equal(html, '<pre><code>still code</code></pre>')
})

test('lists group consecutive items', () => {
  assert.equal(render('- one\n- two'), '<ul>\n<li>one</li>\n<li>two</li>\n</ul>')
  assert.equal(render('1. one\n2. two'), '<ol>\n<li>one</li>\n<li>two</li>\n</ol>')
  assert.equal(
    render('- one\n- two\n\nafter'),
    '<ul>\n<li>one</li>\n<li>two</li>\n</ul>\n<p>after</p>',
  )
})

test('blockquotes collect their lines', () => {
  assert.equal(render('> first\n> second'), '<blockquote><p>first second</p></blockquote>')
})

test('rules and paragraphs can share a document', () => {
  assert.equal(render('before\n\n---\n\nafter'), '<p>before</p>\n<hr>\n<p>after</p>')
})

test('front matter parses scalars and tag lists', () => {
  const { data, body } = frontMatter('---\ntitle: A post\ndate: 2026-11-21\ntags: go, cli , writing\n---\n\nText.')
  assert.equal(data.title, 'A post')
  assert.equal(data.date, '2026-11-21')
  assert.deepEqual(data.tags, ['go', 'cli', 'writing'])
  assert.equal(body, 'Text.')
})

test('a document without front matter is all body', () => {
  const { data, body } = frontMatter('Just text')
  assert.deepEqual(data, {})
  assert.equal(body, 'Just text')
})
