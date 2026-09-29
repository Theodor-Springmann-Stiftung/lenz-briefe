import { parseFragment } from 'parse5';

/** Name the first fragment of each source hand without changing transcription text.
 * @param {string} html
 * @param {Record<string, string>} names
 */
export function labelHandStarts(html, names) {
  const root = parseFragment(html, { sourceCodeLocationInfo: true });
  const seen = new Set();
  const insertions = [];
  function visit(node) {
    const attrs = Object.fromEntries((node.attrs || []).map((attr) => [attr.name, attr.value]));
    if (attrs.class?.split(/\s+/).includes('hand')) {
      // One source hand is reopened across lines and table cells by the XSLT.
      const origin = attrs['data-origin'] || node;
      const startTag = node.sourceCodeLocation?.startTag;
      if (!seen.has(origin) && startTag && !('data-hand-name' in attrs)) {
        const name = (names[attrs['data-ref']] || 'Unbekannte Hand')
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;');
        insertions.push({ offset: startTag.endOffset - 1, value: ` data-hand-name="${name}"` });
      }
      seen.add(origin);
    }
    for (const child of node.childNodes || []) visit(child);
  }
  visit(root);
  for (const { offset, value } of insertions.sort((a, b) => b.offset - a.offset)) {
    html = html.slice(0, offset) + value + html.slice(offset);
  }
  return html;
}
