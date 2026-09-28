import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import pageLinks, { pageImageReferences } from '../scripts/page-links.mjs';

async function fixture(t, base = '/') {
  const directory = await mkdtemp(path.join(tmpdir(), 'lenz-pages-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, 'assets', 'dokumente'), { recursive: true });
  await writeFile(path.join(directory, 'kontakt.md'), 'Kontakt');
  await writeFile(path.join(directory, 'assets', 'dokumente', 'Umschläge 1.pdf'), '%PDF-1.7');
  await writeFile(path.join(directory, 'assets', 'scan.png'), 'image fixture');
  const processor = await createSatteriMarkdownProcessor({
    syntaxHighlight: false,
    mdastPlugins: [pageImageReferences({ directory })],
    hastPlugins: [pageLinks({ directory, base })],
  });
  return (markdown, file = 'test.md') => processor.render(markdown, {
    fileURL: pathToFileURL(path.join(directory, file)),
  });
}

test('Markdown page and download links preserve fragments, Unicode filenames and a deployment prefix', async t => {
  const render = await fixture(t, '/ausgabe/');
  const { code } = await render('[Kontakt](./kontakt.md#redaktion)\n\n[PDF](<./assets/dokumente/Umschläge 1.pdf?download=1#page=2>)');
  assert.match(code, /href="\/ausgabe\/edition\/kontakt\/#redaktion"/);
  assert.match(code, /href="\/ausgabe\/seiten-assets\/dokumente\/Umschl%C3%A4ge%201.pdf\?download=1#page=2"/);
});

test('reference links are rewritten while shared image references remain local for Astro optimization', async t => {
  const render = await fixture(t);
  const { code, metadata } = await render('[Original][scan]\n\n![Abbildung][scan]\n\n![Inline](./assets/scan.png)\n\n[scan]: ./assets/scan.png');
  assert.match(code, /href="\/seiten-assets\/scan.png"/);
  assert.deepEqual(metadata.localImagePaths, ['./assets/scan.png']);
  assert.match(code, /__ASTRO_IMAGE_/);
  assert.equal((code.match(/__ASTRO_IMAGE_/g) || []).length, 2);
});

test('external links, site links, anchors and other Markdown directories are unchanged', async t => {
  const render = await fixture(t);
  const { code } = await render('[Extern](https://example.org/kontakt.md) [Brief](/briefe/199/) [Abschnitt](#abschnitt) [Mail](mailto:edition@example.org)');
  for (const href of ['https://example.org/kontakt.md', '/briefe/199/', '#abschnitt', 'mailto:edition@example.org']) {
    assert.ok(code.includes(`href="${href}"`));
  }
  const elsewhere = await render('[Kontakt](./kontakt.md)', 'other/example.md');
  assert.match(elsewhere.code, /href="\.\/kontakt.md"/);
});

test('missing local pages and downloads fail with the source and target in the error', async t => {
  const render = await fixture(t);
  await assert.rejects(render('[Fehlt](./fehlt.md)'), /Missing linked file.*fehlt\.md.*test\.md/);
  await assert.rejects(render('[Fehlt](./assets/fehlt.pdf)'), /Missing linked file.*fehlt\.pdf.*test\.md/);
});

test('component links and image references resolve relative to the components directory', async t => {
  const render = await fixture(t);
  const { code, metadata } = await render('[Kontakt](../kontakt.md)\n\n[Download](../assets/scan.png)\n\n![Bild][scan]\n\n[scan]: ../assets/scan.png', 'components/lkb-test.md');
  assert.match(code, /href="\/edition\/kontakt\/"/);
  assert.match(code, /href="\/seiten-assets\/scan.png"/);
  assert.deepEqual(metadata.localImagePaths, ['../assets/scan.png']);
});
