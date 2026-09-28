import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import pageLegend, { legendMarker } from '../scripts/page-legend.mjs';

const processor = await createSatteriMarkdownProcessor({
  syntaxHighlight: false,
  mdastPlugins: [pageLegend()],
});

test('standalone legend embeds retain their position and support multiple instances', async () => {
  const { code, metadata } = await processor.render(
    'Before\n\n<lkb-legende></lkb-legende>\n\nBetween\n\n<lkb-legende>\n</lkb-legende>\n\nAfter',
  );
  assert.equal(code, `<p>Before</p>\n${legendMarker}\n<p>Between</p>\n${legendMarker}\n<p>After</p>\n`);
  assert.equal(metadata.frontmatter.hasLegend, true);
});

test('inline code, fenced code and HTML comments do not create legends', async () => {
  const { code, metadata } = await processor.render(
    '`<lkb-legende></lkb-legende>`\n\n```html\n<lkb-legende></lkb-legende>\n```\n\n<!-- <lkb-legende></lkb-legende> -->',
  );
  assert.ok(!code.includes(legendMarker));
  assert.ok(!metadata.frontmatter.hasLegend);
});

test('embeds must occupy a whole top-level block', async () => {
  const { code, metadata } = await processor.render(
    'Words <lkb-legende></lkb-legende> words\n\n> <lkb-legende></lkb-legende>',
  );
  assert.ok(!code.includes(legendMarker));
  assert.ok(!metadata.frontmatter.hasLegend);
});
