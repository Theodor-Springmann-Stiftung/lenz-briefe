import { parseFragment } from 'parse5';

function findElements(html, attribute, value) {
  const matches = [];
  function visit(node) {
    if (node.attrs?.some((attr) => attr.name === attribute && (value === undefined || attr.value === value)))
      matches.push(node);
    for (const child of node.childNodes ?? []) visit(child);
  }
  visit(parseFragment(html, { sourceCodeLocationInfo: true }));
  return matches;
}

function textContent(node) {
  return node.nodeName === '#text'
    ? node.value
    : (node.childNodes ?? []).map(textContent).join('');
}

/** @param {string} html @param {string} kind @returns {string} */
export function legendHelpText(html, kind) {
  const matches = findElements(html, 'data-legend-help', kind);
  if (matches.length !== 1)
    throw new Error(`Expected one ${kind} explanation in lkb-legende.html; found ${matches.length}`);
  const text = textContent(matches[0]).replace(/\s+/g, ' ').trim();
  if (!text) throw new Error(`Empty ${kind} explanation in lkb-legende.html`);
  return text;
}

/** @param {string} html @param {Record<string, string>} icons @returns {string} */
export function expandLegendIcons(html, icons) {
  const replacements = findElements(html, 'data-legend-icon').map((node) => {
    const name = node.attrs.find((attr) => attr.name === 'data-legend-icon').value;
    const svg = Object.hasOwn(icons, name) ? icons[name] : undefined;
    if (!svg) throw new Error(`Unknown legend icon: ${name}`);
    const { startTag, endTag } = node.sourceCodeLocation;
    return { start: startTag.endOffset, end: endTag.startOffset, svg };
  });
  for (const { start, end, svg } of replacements.sort((a, b) => b.start - a.start))
    html = html.slice(0, start) + svg + html.slice(end);
  return html;
}
