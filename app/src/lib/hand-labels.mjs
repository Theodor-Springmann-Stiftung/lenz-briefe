import { parseFragment } from 'parse5';

const escapeAttribute = (text) =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Collect source hands once, retaining the original transcription markup.
 * @param {string} html
 * @param {Record<string, string>} names
 * @param {{ anchors?: boolean, labelStarts?: boolean, baseRef?: string }} options
 */
export function prepareHandControls(html, names, { anchors = false, labelStarts = false, baseRef } = {}) {
  const root = parseFragment(html, { sourceCodeLocationInfo: true });
  const seen = new Set();
  const labels = [];
  const insertions = [];
  let explicitIndex = 0;
  let baseIndex = 0;
  let previousRef;
  function visit(node, inheritedRef, ignoreImplicit = false) {
    const attrs = Object.fromEntries((node.attrs || []).map((attr) => [attr.name, attr.value]));
    const classes = attrs.class?.split(/\s+/) || [];
    // Editorial annotations cannot establish the base writer, but explicit
    // hand tags must always be collected, including inside other markup.
    ignoreImplicit ||= classes.some((name) => ['note', 'sidenote-slot', 'inpos-note', 'letter-image'].includes(name));
    if (baseRef && classes.includes('hand-base-start')) {
      baseIndex++;
      previousRef = baseRef;
      labels.push({ ref: baseRef, name: names[baseRef] || 'Unbekannte Hand', anchor: attrs.id });
      return;
    }
    if (classes.includes('hand')) {
      inheritedRef = attrs['data-ref'];
      // One source hand is reopened across lines and table cells by the XSLT.
      const origin = attrs['data-origin'] || node;
      const startTag = node.sourceCodeLocation?.startTag;
      if (!seen.has(origin) && startTag) {
        const ref = attrs['data-ref'];
        const name = names[ref] || 'Unbekannte Hand';
        explicitIndex++;
        const anchor = attrs.id || `hand-${explicitIndex}`;
        labels.push({ ref, name, anchor });
        let attributes = '';
        if (anchors && !attrs.id) attributes += ` id="${escapeAttribute(anchor)}"`;
        if (labelStarts && !('data-hand-name' in attrs))
          attributes += ` data-hand-name="${escapeAttribute(name)}"`;
        if (attributes) insertions.push({ offset: startTag.endOffset - 1, value: attributes });
      }
      seen.add(origin);
    }
    if (baseRef && node.nodeName === '#text' && node.value.trim() && (inheritedRef || !ignoreImplicit)) {
      const ref = inheritedRef || baseRef;
      if (!inheritedRef && previousRef !== baseRef && node.sourceCodeLocation) {
        const name = names[baseRef] || 'Unbekannte Hand';
        const anchor = `hand-base-${++baseIndex}`;
        labels.push({ ref: baseRef, name, anchor });
        if (anchors || labelStarts) {
          const start = node.sourceCodeLocation.startOffset;
          const whitespace = html.slice(start, node.sourceCodeLocation.endOffset).match(/^\s*/)[0].length;
          insertions.push({
            offset: start + whitespace,
            value: `<span class="hand-base-start" id="${anchor}"${labelStarts ? ` data-hand-name="${escapeAttribute(name)}"` : ''}></span>`,
          });
        }
      }
      previousRef = ref;
    }
    for (const child of node.childNodes || []) visit(child, inheritedRef, ignoreImplicit);
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
