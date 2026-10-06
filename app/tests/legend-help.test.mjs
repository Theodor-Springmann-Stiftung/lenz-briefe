import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { legendHelpText, expandLegendIcons } from '../src/lib/legend-help.mjs';

const legend = await readFile(new URL('../../seiten/components/lkb-legende.html', import.meta.url), 'utf8');
const icons = {
  printer: await readFile(new URL('../node_modules/remixicon/icons/Business/printer-line.svg', import.meta.url), 'utf8'),
  search: await readFile(new URL('../node_modules/remixicon/icons/System/search-line.svg', import.meta.url), 'utf8'),
};

test('legend help supports editorial markup and entities without leaking comments', () => {
  const source = `<!-- <p data-legend-help="search">Old text</p> -->
    <p data-legend-help="search">Find <em>letters</em> &amp; notes.\nAcross pages.</p>`;
  assert.equal(legendHelpText(source, 'search'), 'Find letters & notes. Across pages.');
  assert.throws(() => legendHelpText(source, 'print'), /found 0/);
  assert.throws(() => legendHelpText(source + source, 'search'), /found 2/);
  assert.throws(() => legendHelpText('<p data-legend-help="search"> </p>', 'search'), /Empty search/);
});

test('the shared legend explanations follow Layout and preserve their text when icons render', () => {
  const printText = legendHelpText(legend, 'print');
  const searchText = legendHelpText(legend, 'search');
  assert.ok(legend.indexOf('data-legend-help="print"') > legend.indexOf('<h3>Layout</h3>'));
  assert.ok(legend.indexOf('data-legend-help="search"') > legend.indexOf('data-legend-help="print"'));
  const rendered = expandLegendIcons(legend, icons);
  for (const svg of Object.values(icons)) assert.ok(rendered.includes(svg));
  assert.equal(legendHelpText(rendered, 'print'), printText);
  assert.equal(legendHelpText(rendered, 'search'), searchText);
});

test('icon expansion preserves surrounding HTML and ignores commented examples', () => {
  const source = '<!-- <span data-legend-icon="search"></span> -->\n<h3><span class="ui-icon" data-legend-icon="search" aria-hidden="true"></span> Suche</h3>';
  assert.equal(expandLegendIcons(source, icons), source.replace('aria-hidden="true"></span>', `aria-hidden="true">${icons.search}</span>`));
  assert.throws(() => expandLegendIcons('<span data-legend-icon="unknown"></span>', icons), /Unknown legend icon/);
});
