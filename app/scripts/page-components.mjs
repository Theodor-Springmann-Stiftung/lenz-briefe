import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFragment } from 'parse5';

export const componentMarker = name => `<!--lkb:component:${name}-->`;
export const componentPattern = /<!--lkb:component:([a-z][a-z0-9]*(?:-[a-z0-9]+)+)-->/g;
export const validComponentName = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;

export function componentName(file) {
  const name = path.basename(file).replace(/\.(md|html)$/, '');
  if (!validComponentName.test(name)) throw new Error(`Invalid component filename: ${file}. Use a lowercase name with a hyphen, e.g. lkb-info.md or lkb-info.html.`);
  return name;
}

/** @param {Record<string, () => Promise<string>>} files */
export function indexComponentFiles(files) {
  const components = new Map();
  for (const [file, load] of Object.entries(files)) {
    const name = componentName(file);
    const previous = components.get(name);
    if (previous) throw new Error(`Duplicate component "${name}": ${previous.file} and ${file}. Keep either the .md or the .html file.`);
    components.set(name, { file, load, format: path.extname(file).slice(1) });
  }
  return components;
}

// Only replace actual empty custom elements. Use source offsets so surrounding
// HTML, whitespace, scripts and styles are passed through without serialization.
export function markHtmlComponents(html) {
  const root = parseFragment(html, { sourceCodeLocationInfo: true });
  const replacements = [];
  const literal = new Set(['script', 'style', 'pre', 'code', 'textarea', 'template']);
  function visit(node) {
    if (literal.has(node.tagName)) return;
    const location = node.sourceCodeLocation;
    if (node.tagName && validComponentName.test(node.tagName)
        && node.attrs.length === 0 && location?.endTag
        && node.childNodes.every(child => child.nodeName === '#text' && !child.value.trim())) {
      replacements.push({ start: location.startOffset, end: location.endOffset, name: node.tagName });
      return;
    }
    for (const child of node.childNodes ?? []) visit(child);
  }
  visit(root);
  for (const { start, end, name } of replacements.sort((a, b) => b.start - a.start)) {
    html = html.slice(0, start) + componentMarker(name) + html.slice(end);
  }
  return html;
}

export default function pageComponents({ directory } = {}) {
  return ({ fileURL }) => {
    if (directory && (!fileURL || ![directory, path.join(directory, 'components')].includes(path.dirname(fileURLToPath(fileURL))))) return null;
    return {
      name: 'lenz:page-components',
      before(root, ctx) {
        for (const node of root.children) {
          // Unknown HTML tags may be parsed as a paragraph with inline HTML.
          const pieces = node.type === 'paragraph' ? node.children : [node];
          if (!pieces.every(piece => piece.type === 'html' || (piece.type === 'text' && !piece.value.trim()))) continue;
          const source = pieces.map(piece => piece.value).join('');
          const match = source.match(/^\s*<([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\s*>\s*<\/\1\s*>\s*$/);
          if (!match) continue;
          const name = match[1];
          ctx.replaceNode(node, { type: 'html', value: componentMarker(name) });
          if (name === 'lkb-legende') ctx.data.astro.frontmatter.hasLegend = true;
        }
      },
    };
  };
}
