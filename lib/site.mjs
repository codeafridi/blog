/** Small helpers the build needs, kept separate so they can be tested. */

export const escapeXML = (s) =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

/** `2026-11-21-a-failed-rename` for a dated post. */
export function slugify(title, date) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70)
  return date ? `${date}-${slug}` : slug
}

/** Words per minute, rounded up, with code blocks counted at face value. */
export function readingTime(markdown) {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 220))
}

export const isoDate = (d) => new Date(d).toISOString().slice(0, 10)

export function humanDate(d) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** RSS 2.0 feed with summaries; the site is static, so there is no pagination. */
export function rss({ site, posts }) {
  const items = posts
    .slice(0, 20)
    .map(
      (p) => `    <item>
      <title>${escapeXML(p.title)}</title>
      <link>${escapeXML(site.url + '/' + p.slug + '.html')}</link>
      <guid>${escapeXML(site.url + '/' + p.slug + '.html')}</guid>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <description>${escapeXML(p.summary)}</description>
    </item>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXML(site.title)}</title>
    <link>${escapeXML(site.url)}</link>
    <description>${escapeXML(site.description)}</description>
    <language>en</language>
    <lastBuildDate>${new Date(posts[0]?.date ?? Date.now()).toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`
}
