// Only standalone HTML blocks are embeds; code samples remain literal text.
export const legendMarker = '<!--lkb:legende-->';

export default function pageLegend() {
  return () => ({
    name: 'lenz:page-legend',
    before(root, ctx) {
      for (const node of root.children) {
        // Some parsers treat unknown custom tags as inline HTML in a paragraph.
        const pieces = node.type === 'paragraph' ? node.children : [node];
        if (!pieces.every(piece => piece.type === 'html' || (piece.type === 'text' && !piece.value.trim()))) continue;
        const source = pieces.map(piece => piece.value).join('');
        if (!/^\s*<lkb-legende\s*>\s*<\/lkb-legende\s*>\s*$/i.test(source)) continue;
        ctx.replaceNode(node, { type: 'html', value: legendMarker });
        ctx.data.astro.frontmatter.hasLegend = true;
      }
    },
  });
}
