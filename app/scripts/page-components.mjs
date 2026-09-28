import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const componentMarker = name => `<!--lkb:component:${name}-->`;
export const componentPattern = /<!--lkb:component:([a-z][a-z0-9]*(?:-[a-z0-9]+)+)-->/g;
export const validComponentName = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;

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
