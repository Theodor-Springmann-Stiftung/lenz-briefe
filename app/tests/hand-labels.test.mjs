import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseFragment} from 'parse5';
import {labelHandStarts} from '../src/lib/hand-labels.mjs';

function labels(html) {
  const result = [];
  function visit(node) {
    const attrs = Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
    if ('data-hand-name' in attrs) result.push(attrs);
    node.childNodes?.forEach(visit);
  }
  visit(parseFragment(html));
  return result;
}

test('a hand continued across lines and cells is labelled once, with a fresh label for a later source hand', () => {
  const source = '<div><span class="hand" data-ref="1" data-origin="a">First</span></div>'
    + '<div class="tab"><span class="hand" data-ref="1" data-origin="a">continued</span></div>'
    + '<div><span class="hand" data-ref="2" data-origin="b">Other</span>'
    + '<span class="hand" data-ref="1" data-origin="c">Return</span></div>';
  const output = labelHandStarts(source, {'1': 'Lenz', '2': 'Goethe'});
  assert.deepEqual(labels(output).map(attrs => [attrs['data-origin'], attrs['data-hand-name']]),
    [['a', 'Lenz'], ['b', 'Goethe'], ['c', 'Lenz']]);
  assert.equal(output.replace(/ data-hand-name="[^"]*"/g, ''), source);
});

test('names are safely escaped and page targets, word boundaries and sidenote slots are untouched', () => {
  const source = '<span class="hand" data-ref="1" data-origin="a">Wor'
    + '<span class="page-anchor" id="page-4" data-index="4" data-break="inline"></span>d</span>'
    + '<div class="sidenote-slot" data-sidenote-id="note-1"></div>';
  const name = 'A "B" & <C>';
  const output = labelHandStarts(source, {'1': name});
  assert.equal(labels(output)[0]['data-hand-name'], name);
  assert.equal(output.replace(/ data-hand-name="[^"]*"/g, ''), source);
  assert.equal(labelHandStarts(output, {'1': name}), output);
});

test('hands without source identifiers remain separate and missing names have a readable fallback', () => {
  const source = '<span class="hand" data-ref="99">A</span><span class="hand" data-ref="99">B</span>';
  assert.deepEqual(labels(labelHandStarts(source, {})).map(attrs => attrs['data-hand-name']),
    ['Unbekannte Hand', 'Unbekannte Hand']);
  assert.equal(labelHandStarts('<div>Plain text</div>', {}), '<div>Plain text</div>');
});
