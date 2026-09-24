import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSearch, prepareSearch, searchBlocks, matchRanges, searchPreview, matchPages} from '../src/lib/search.mjs';

test('literal substring search ignores case, Unicode punctuation and whitespace', () => {
  const blocks = prepareSearch([{text: 'Mein, lieber\u00a0Freund!'}, {text: 'Kein Freund'}]);
  assert.equal(searchBlocks(blocks, 'MEINLIEBER freund').length, 1);
  assert.equal(searchBlocks(blocks, 'lieberfr').length, 1);
  assert.equal(normalizeSearch('„Ja“—nein…\n!'), 'janein');
  assert.equal(searchBlocks(blocks, ' \n…?!').length, 0);
  assert.equal(searchBlocks(blocks, '.*').length, 0);
  assert.notEqual(normalizeSearch('schön'), normalizeSearch('schon'));
  assert.notEqual(normalizeSearch('Straße'), normalizeSearch('Strasse'));
});

test('search cannot bridge independently exported blocks or table cells', () => {
  const blocks = prepareSearch([{text: 'Mein lieber'}, {text: 'Freund'}]);
  assert.equal(searchBlocks(blocks, 'lieber Freund').length, 0);
});

test('highlight offsets retain punctuation, whitespace and composed/decomposed Unicode', () => {
  const text = '😀 — Mein, lieber\u00a0Freund!';
  const [range] = matchRanges(text, 'meinlieberfreund');
  assert.equal(text.slice(range.start, range.end), 'Mein, lieber\u00a0Freund');
  const decomposed = 'Mit gru\u0308ßendem Herzen';
  const [accent] = matchRanges(decomposed, 'GRÜSSEND'.replace('SS', 'ẞ'));
  assert.equal(decomposed.slice(accent.start, accent.end), 'gru\u0308ßend');
});

test('previews shorten both sides around the first match and mark every visible match', () => {
  const text = 'Vorlauf '.repeat(40) + 'Mein, Freund! Mein Freund.' + ' Nachlauf'.repeat(40);
  const parts = searchPreview(text, 'meinfreund', 35);
  assert.equal(parts[0].text, '… ');
  assert.equal(parts.at(-1).text, ' …');
  assert.deepEqual(parts.filter(p => p.match).map(p => p.text), ['Mein, Freund', 'Mein Freund']);
  assert.ok(parts.map(p => p.text).join('').length < 110);
  assert.deepEqual(searchPreview(text, 'nicht vorhanden'), []);
});

test('overlapping matches do not duplicate preview text', () => {
  const parts = searchPreview('Banana', 'ana');
  assert.equal(parts.map(p => p.text).join(''), 'Banana');
  assert.equal(parts.filter(p => p.match).map(p => p.text).join(''), 'anana');
});

test('page labels identify the match itself, including matches across a page break', () => {
  const block = {text:'Mein lieber Freund', pages:[[0, '1'], [15, '2']]};
  assert.deepEqual(matchPages(block, 'mein'), ['1']);
  assert.deepEqual(matchPages(block, 'Freund'), ['1', '2']);
  assert.deepEqual(matchPages(block, 'und'), ['2']);
  assert.deepEqual(matchPages({text:'Text ohne Seitenmarken'}, 'Text'), []);
  assert.deepEqual(matchPages(block, 'nicht vorhanden'), []);
});
