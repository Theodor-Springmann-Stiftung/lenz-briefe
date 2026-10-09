import test from 'node:test';
import assert from 'node:assert/strict';
import { markLandscapeEditorialImages } from '../src/lib/editorial-images.mjs';

test('only landscape editorial images use the extra column width', () => {
  const figure = (width, height, className = 'editorial-image') =>
    `<figure class="${className}"><p><a><img width="${width}" height="${height}"></a></p><figcaption>Caption</figcaption></figure>`;
  const landscape = figure(1443, 1200);
  assert.equal(markLandscapeEditorialImages(landscape), landscape.replace('><p>', ' data-landscape><p>'));
  for (const html of [figure(1200, 1443), figure(1200, 1200), figure('', ''), figure(1443, 1200, 'page-portrait')])
    assert.equal(markLandscapeEditorialImages(html), html);
});

test('marks multiple landscape images without changing surrounding content', () => {
  const figure = '<figure class="editorial-image"><img width="2" height="1"></figure>';
  const html = `<!--lkb-legende-->${figure}<p>Text</p>${figure}`;
  assert.equal(markLandscapeEditorialImages(html), html.replaceAll('class="editorial-image">', 'class="editorial-image" data-landscape>'));
});
