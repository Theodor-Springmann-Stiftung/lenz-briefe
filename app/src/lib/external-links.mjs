import { parse } from 'parse5';

/** Update rendered links, including reusable templates, without reserializing the page. */
export function externalLinks(html, pageUrl, siteUrl = pageUrl) {
  const internalOrigins = new Set([new URL(pageUrl).origin, new URL(siteUrl).origin]);
  const edits = [];
  const visit = (node) => {
    if (node.tagName === 'a') {
      const href = node.attrs.find((attr) => attr.name === 'href')?.value;
      let url;
      try { url = new URL(href ?? '', pageUrl); } catch { /* Invalid links stay unchanged. */ }
      const location = node.sourceCodeLocation;
      if (url && /^https?:$/.test(url.protocol) && !internalOrigins.has(url.origin) && location?.startTag) {
        const rel = new Set((node.attrs.find((attr) => attr.name === 'rel')?.value ?? '').split(/\s+/).filter(Boolean));
        rel.add('noopener');
        let additions = '';
        for (const [name, value] of [['target', '_blank'], ['rel', [...rel].join(' ')]]) {
          const attribute = `${name}="${value.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"`;
          const existing = location.attrs?.[name];
          if (existing) edits.push({ start: existing.startOffset, end: existing.endOffset, text: attribute });
          else additions += ` ${attribute}`;
        }
        if (additions) {
          let end = location.startTag.endOffset - 1;
          if (html[end - 1] === '/') end--;
          edits.push({ start: end, end, text: additions });
        }
      }
    }
    for (const child of node.childNodes ?? []) visit(child);
    if (node.content) visit(node.content);
  };
  visit(parse(html, { sourceCodeLocationInfo: true }));
  for (const edit of edits.sort((a, b) => b.start - a.start))
    html = html.slice(0, edit.start) + edit.text + html.slice(edit.end);
  return html;
}
