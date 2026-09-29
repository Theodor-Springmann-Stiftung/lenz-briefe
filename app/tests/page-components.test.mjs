import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import pageComponents, { componentMarker, indexComponentFiles, markHtmlComponents } from '../scripts/page-components.mjs';
const legendMarker = componentMarker('lkb-legende');

const processor = await createSatteriMarkdownProcessor({
  syntaxHighlight: false,
  mdastPlugins: [pageComponents()],
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

test('any lowercase custom-element name can refer to a component', async () => {
  const { code, metadata } = await processor.render('Before\n\n<lkb-kontakt></lkb-kontakt>\n\n<edition-info-box>\n</edition-info-box>');
  assert.ok(code.includes(componentMarker('lkb-kontakt')));
  assert.ok(code.includes(componentMarker('edition-info-box')));
  assert.ok(!metadata.frontmatter.hasLegend);
});

test('ordinary HTML and custom elements with attributes or content stay unchanged', async () => {
  const { code } = await processor.render('<div></div>\n\n<lkb-info title="Title"></lkb-info>\n\n<lkb-info>Content</lkb-info>');
  assert.ok(!code.includes('<!--lkb:component:'));
});

test('both component formats resolve by tag name and duplicate names fail clearly', async () => {
  const markdown = async () => '**Markdown**';
  const html = async () => '<strong>HTML</strong>';
  const files = indexComponentFiles({ 'lkb-text.md': markdown, 'lkb-card.html': html });
  assert.equal(files.get('lkb-text').format, 'md');
  assert.equal(files.get('lkb-card').format, 'html');
  assert.equal(await files.get('lkb-card').load(), '<strong>HTML</strong>');
  assert.throws(() => indexComponentFiles({ 'lkb-card.md': markdown, 'lkb-card.html': html }), /Duplicate component.*lkb-card\.md.*lkb-card\.html/);
  assert.throws(() => indexComponentFiles({ 'Invalid.html': html }), /Invalid component filename/);
});

test('HTML embeds can nest in containers without reformatting surrounding source', () => {
  const source = '<section class="p-4" data-label="a > b">\r\n\n  **literal Markdown**\n  <lkb-text> \n </lkb-text>\n  <div><lkb-card></lkb-card></div>\n</section>';
  assert.equal(markHtmlComponents(source), source
    .replace('<lkb-text> \n </lkb-text>', componentMarker('lkb-text'))
    .replace('<lkb-card></lkb-card>', componentMarker('lkb-card')));
});

test('HTML scripts, styles, templates, comments and code examples pass through verbatim', () => {
  const source = `<!-- <lkb-text></lkb-text> -->
<script type="module">
  const example = '<lkb-text></lkb-text>';
  if (!customElements.get('lkb-counter')) {
    customElements.define('lkb-counter', class extends HTMLElement {});
  }
</script>
<style>lkb-counter::before { content: '<lkb-text></lkb-text>'; }</style>
<template><lkb-text></lkb-text></template>
<pre><lkb-text></lkb-text></pre>
<code>&lt;lkb-text&gt;&lt;/lkb-text&gt;</code>
<textarea><lkb-text></lkb-text></textarea>
<lkb-text title="own element"></lkb-text>
<lkb-text>Own content</lkb-text>`;
  assert.equal(markHtmlComponents(source), source);
});
