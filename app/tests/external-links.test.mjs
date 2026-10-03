import test from 'node:test';
import assert from 'node:assert/strict';
import { externalLinks } from '../src/lib/external-links.mjs';
import config from '../astro.config.mjs';

const site = new URL(config.site).href;
const rewrite = (html) => externalLinks(html, 'http://localhost:4321/', site);

test('external links and card templates open separately, preserving existing rel tokens and markup', () => {
  const html = '<!doctype html><template><a href="https://lobid.org/gnd/118571656" rel="license noreferrer" target="_self">GND &amp; more</a></template><script>const a = "<a href=bad>";</script>';
  const result = rewrite(html);
  assert.equal(result, html.replace('rel="license noreferrer" target="_self"', 'rel="license noreferrer noopener" target="_blank"'));
  assert.equal(rewrite(result), result);
});

test('relative, same-site, fragment, mail and download links within the site remain unchanged', () => {
  for (const href of ['/briefe/1/', '#note', '?person=1', new URL('edition/', site).href, 'http://localhost:4321/', 'mailto:archiv@example.org', '/licenses/LICENSE.txt']) {
    const html = `<a href="${href}">Link</a>`;
    assert.equal(rewrite(html), html);
  }
});

test('protocol-relative links and HTTP links are external too', () => {
  for (const href of ['//viaf.org/viaf/90638588', 'http://viaf.org/viaf/90638588']) {
    assert.equal(rewrite(`<a href="${href}">VIAF</a>`), `<a href="${href}" target="_blank" rel="noopener">VIAF</a>`);
  }
});
