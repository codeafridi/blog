/**
 * A deliberately small Markdown renderer: headings, paragraphs, lists,
 * blockquotes, fenced code, rules, and inline code/emphasis/links.
 *
 * Written by hand instead of pulled in, because a blog is mostly text and the
 * escaping rules are the part that matters. Everything is escaped first, then
 * only the constructs below are turned back into HTML, so a post cannot inject
 * markup by accident.
 */

const escapeHTML = (s) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const isSafeURL = (url) => /^(https?:\/\/|mailto:|\/|#)/i.test(url)

/** Inline formatting for one line of text. */
export function inline(text) {
  const codes = []
  let out = escapeHTML(text)

  // Code spans first, so their content is never treated as emphasis or a link.
  out = out.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(code)
    return `\u0000${codes.length - 1}\u0000`
  })

  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
    if (!isSafeURL(url)) return match
    const href = url.replaceAll('"', '%22')
    return `<a href="${href}">${label}</a>`
  })

  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  out = out.replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>')

  out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`)
  return out
}

/** Render a whole document to HTML. */
export function render(markdown) {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n')
  const html = []

  let paragraph = []
  let list = null // 'ul' | 'ol'
  let quote = []
  let fence = null

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      html.push(`<p>${inline(paragraph.join(' '))}</p>`)
      paragraph = []
    }
  }
  const flushList = () => {
    if (list) {
      html.push(`</${list}>`)
      list = null
    }
  }
  const flushQuote = () => {
    if (quote.length > 0) {
      html.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`)
      quote = []
    }
  }
  const flushAll = () => {
    flushParagraph()
    flushList()
    flushQuote()
  }

  for (const line of lines) {
    if (fence) {
      if (line.trimStart().startsWith('```')) {
        const lang = fence.lang ? ` class="language-${escapeHTML(fence.lang)}"` : ''
        html.push(`<pre><code${lang}>${escapeHTML(fence.lines.join('\n'))}</code></pre>`)
        fence = null
      } else {
        fence.lines.push(line)
      }
      continue
    }

    const fenceStart = line.match(/^\s*```(\w+)?\s*$/)
    if (fenceStart) {
      flushAll()
      fence = { lang: fenceStart[1] ?? '', lines: [] }
      continue
    }

    if (line.trim() === '') {
      flushAll()
      continue
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      flushAll()
      // The page owns <h1>; both '#' and '##' are sections of the article.
      const level = Math.max(2, heading[1].length)
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      continue
    }

    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      flushAll()
      html.push('<hr>')
      continue
    }

    const quoteLine = line.match(/^\s*>\s?(.*)$/)
    if (quoteLine) {
      flushParagraph()
      flushList()
      quote.push(quoteLine[1])
      continue
    }

    const ordered = line.match(/^\s*\d+\.\s+(.*)$/)
    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    if (ordered || bullet) {
      flushParagraph()
      flushQuote()
      const kind = ordered ? 'ol' : 'ul'
      if (list !== kind) {
        flushList()
        list = kind
        html.push(`<${kind}>`)
      }
      html.push(`<li>${inline((ordered ?? bullet)[1])}</li>`)
      continue
    }

    flushList()
    flushQuote()
    paragraph.push(line.trim())
  }

  if (fence) {
    // An unclosed fence is still code; better to show it than to drop it.
    html.push(`<pre><code>${escapeHTML(fence.lines.join('\n'))}</code></pre>`)
  }
  flushAll()

  return html.join('\n')
}

/** Split `---` front matter from the body. Values are strings or string lists. */
export function frontMatter(source) {
  const text = source.replaceAll('\r\n', '\n')
  if (!text.startsWith('---\n')) return { data: {}, body: text }

  const end = text.indexOf('\n---', 4)
  if (end === -1) return { data: {}, body: text }

  const data = {}
  for (const line of text.slice(4, end).split('\n')) {
    const match = line.match(/^([a-zA-Z][\w-]*):\s*(.*)$/)
    if (!match) continue
    const [, key, raw] = match
    const value = raw.trim()
    data[key] = key === 'tags'
      ? value.split(',').map((t) => t.trim()).filter(Boolean)
      : value.replace(/^["']|["']$/g, '')
  }

  return { data, body: text.slice(end + 4).replace(/^\n+/, '') }
}
