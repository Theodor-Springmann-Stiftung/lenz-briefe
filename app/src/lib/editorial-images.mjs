import { parseFragment } from 'parse5';

/** Classify images from Astro's generated dimensions before the page is shown.
 * @param {string} html @returns {string}
 */
export function markLandscapeEditorialImages(html) {
  const insertions = [];
  const attribute = (node, name) => node.attrs?.find((attr) => attr.name === name)?.value;
  function findImage(node) {
    if (node.tagName === 'img') return node;
    for (const child of node.childNodes ?? []) {
      const image = findImage(child);
      if (image) return image;
    }
  }
  function visit(node) {
    if (node.tagName === 'figure' && attribute(node, 'class')?.split(/\s+/).includes('editorial-image')) {
      const image = findImage(node);
      const width = Number(attribute(image ?? {}, 'width'));
      const height = Number(attribute(image ?? {}, 'height'));
      if (Number.isFinite(width) && height > 0 && width > height)
        insertions.push(node.sourceCodeLocation.startTag.endOffset - 1);
    }
    for (const child of node.childNodes ?? []) visit(child);
  }
  visit(parseFragment(html, { sourceCodeLocationInfo: true }));
  for (const offset of insertions.sort((a, b) => b - a))
    html = html.slice(0, offset) + ' data-landscape' + html.slice(offset);
  return html;
}
