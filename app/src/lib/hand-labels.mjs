import { parseFragment } from 'parse5';

const escapeAttribute = (text) =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Collect source hands once, retaining the original transcription markup.
 * @param {string} html
 * @param {Record<string, string>} names
 * @param {{ anchors?: boolean, labelStarts?: boolean }} options
 */
export function prepareHandControls(html, names, { anchors = false, labelStarts = false } = {}) {
  const root = parseFragment(html, { sourceCodeLocationInfo: true });
  const seen = new Set();
  const labels = [];
  const insertions = [];
  function visit(node) {
    const attrs = Object.fromEntries((node.attrs || []).map((attr) => [attr.name, attr.value]));
    if (attrs.class?.split(/\s+/).includes('hand')) {
      // One source hand is reopened across lines and table cells by the XSLT.
      const origin = attrs['data-origin'] || node;
      const startTag = node.sourceCodeLocation?.startTag;
      if (!seen.has(origin) && startTag) {
        const ref = attrs['data-ref'];
        const name = names[ref] || 'Unbekannte Hand';
        const anchor = attrs.id || `hand-${labels.length + 1}`;
        labels.push({ ref, name, anchor });
        let attributes = '';
        if (anchors && !attrs.id) attributes += ` id="${escapeAttribute(anchor)}"`;
        if (labelStarts && !('data-hand-name' in attrs))
          attributes += ` data-hand-name="${escapeAttribute(name)}"`;
        if (attributes) insertions.push({ offset: startTag.endOffset - 1, value: attributes });
      }
      seen.add(origin);
    }
    for (const child of node.childNodes || []) visit(child);
  }
  visit(root);
  for (const { offset, value } of insertions.sort((a, b) => b.offset - a.offset)) {
    html = html.slice(0, offset) + value + html.slice(offset);
  }
  return { html, labels };
}

/** Name the first fragment of each source hand without changing transcription text. */
export function labelHandStarts(html, names) {
  return prepareHandControls(html, names, { labelStarts: true }).html;
}
