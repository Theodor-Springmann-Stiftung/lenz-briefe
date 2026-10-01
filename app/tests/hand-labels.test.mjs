import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFragment } from 'parse5';
import { labelHandStarts, prepareHandControls } from '../src/lib/hand-labels.mjs';

function labels(html) {
  const result = [];
  function visit(node) {
    const attrs = Object.fromEntries((node.attrs || []).map((attr) => [attr.name, attr.value]));
    if ('data-hand-name' in attrs) result.push(attrs);
    node.childNodes?.forEach(visit);
  }
  visit(parseFragment(html));
  return result;
}

test('a hand continued across lines and cells is labelled once, with a fresh label for a later source hand', () => {
  const source =
    '<div><span class="hand" data-ref="1" data-origin="a">First</span></div>' +
    '<div class="tab"><span class="hand" data-ref="1" data-origin="a">continued</span></div>' +
    '<div><span class="hand" data-ref="2" data-origin="b">Other</span>' +
    '<span class="hand" data-ref="1" data-origin="c">Return</span></div>';
  const output = labelHandStarts(source, { 1: 'Lenz', 2: 'Goethe' });
  assert.deepEqual(
    labels(output).map((attrs) => [attrs['data-origin'], attrs['data-hand-name']]),
    [
      ['a', 'Lenz'],
      ['b', 'Goethe'],
      ['c', 'Lenz'],
    ],
  );
  assert.equal(output.replace(/ data-hand-name="[^"]*"/g, ''), source);
});

test('names are safely escaped and page targets, word boundaries and sidenote slots are untouched', () => {
  const source =
    '<span class="hand" data-ref="1" data-origin="a">Wor' +
    '<span class="page-anchor" id="page-4" data-index="4" data-break="inline"></span>d</span>' +
    '<div class="sidenote-slot" data-sidenote-id="note-1"></div>';
  const name = 'A "B" & <C>';
  const output = labelHandStarts(source, { 1: name });
  assert.equal(labels(output)[0]['data-hand-name'], name);
  assert.equal(output.replace(/ data-hand-name="[^"]*"/g, ''), source);
  assert.equal(labelHandStarts(output, { 1: name }), output);
});

test('hands without source identifiers remain separate and missing names have a readable fallback', () => {
  const source =
    '<span class="hand" data-ref="99">A</span><span class="hand" data-ref="99">B</span>';
  assert.deepEqual(
    labels(labelHandStarts(source, {})).map((attrs) => attrs['data-hand-name']),
    ['Unbekannte Hand', 'Unbekannte Hand'],
  );
  assert.equal(labelHandStarts('<div>Plain text</div>', {}), '<div>Plain text</div>');
});

test('build-time controls share stable anchors across reopened fragments and preserve existing IDs', async () => {
  const { prepareHandControls } = await import('../src/lib/hand-labels.mjs');
  const source =
    '<span class="hand" data-ref="1" data-origin="a">A</span>' +
    '<span class="hand" data-ref="1" data-origin="a">B</span>' +
    '<span id="existing" class="hand" data-ref="2" data-origin="b">C</span>';
  const result = prepareHandControls(
    source,
    { 1: 'Lenz', 2: 'Goethe' },
    { anchors: true, labelStarts: true },
  );
  assert.deepEqual(result.labels, [
    { ref: '1', name: 'Lenz', anchor: 'hand-1' },
    { ref: '2', name: 'Goethe', anchor: 'existing' },
  ]);
  assert.equal(labels(result.html)[0].id, 'hand-1');
  assert.equal(labels(result.html)[1].id, 'existing');
  assert.equal(
    prepareHandControls(
      result.html,
      { 1: 'Lenz', 2: 'Goethe' },
      { anchors: true, labelStarts: true },
    ).html,
    result.html,
  );
});

test('note annotations collect groups without changing note HTML or collapsing later occurrences', async () => {
  const { prepareHandControls } = await import('../src/lib/hand-labels.mjs');
  const source =
    '<span class="hand" data-ref="1" data-origin="a">A</span>' +
    '<span class="hand" data-ref="1" data-origin="a">B</span>' +
    '<span class="hand" data-ref="2" data-origin="b">C</span>' +
    '<span class="hand" data-ref="1" data-origin="c">D</span>';
  const result = prepareHandControls(source, { 1: 'A "B" & <C>' });
  assert.equal(result.html, source);
  assert.deepEqual(
    result.labels.map(({ ref, name }) => [ref, name]),
    [
      ['1', 'A "B" & <C>'],
      ['2', 'Unbekannte Hand'],
      ['1', 'A "B" & <C>'],
    ],
  );
});

test('base passages before and after another hand receive their own labels without changing text', () => {
  const source = '<div>  Before <em>continued</em>' +
    '<span class="hand" data-ref="2" data-origin="a">Other writer</span> After</div>' +
    '<div>Still the base writer</div>';
  const options = { anchors: true, labelStarts: true, baseRef: '1' };
  const result = prepareHandControls(source, { 1: 'Lenz', 2: 'Goethe' }, options);
  assert.deepEqual(result.labels, [
    { ref: '1', name: 'Lenz', anchor: 'hand-base-1' },
    { ref: '2', name: 'Goethe', anchor: 'hand-1' },
    { ref: '1', name: 'Lenz', anchor: 'hand-base-2' },
  ]);
  assert.equal(result.html
    .replace(/<span class="hand-base-start"[^>]*><\/span>/g, '')
    .replace(/ id="hand-1"| data-hand-name="[^"]*"/g, ''), source);
  assert.deepEqual(prepareHandControls(result.html, { 1: 'Lenz', 2: 'Goethe' }, options), result);
});

test('whitespace, page markers and editorial notes do not start a base passage', () => {
  const source = '<span class="hand" data-ref="2" data-origin="a">Other</span>' +
    ' \n<div> &nbsp; </div><span class="page-anchor" id="page-2"></span>' +
    '<span class="note">Editorial text</span>' +
    '<div class="sidenote-slot" data-sidenote-id="note-1"></div>' +
    '<span class="hand" data-ref="2" data-origin="a">Continued</span> \n';
  const result = prepareHandControls(source, { 1: 'Lenz', 2: 'Goethe' },
    { anchors: true, labelStarts: true, baseRef: '1' });
  assert.deepEqual(result.labels.map(({ ref }) => ref), ['2']);
  assert.ok(!result.html.includes('hand-base-start'));
});

test('an explicitly tagged base hand continues into untagged text without a duplicate label', () => {
  const source = '<span class="hand" data-ref="1" data-origin="a">Base</span> continued' +
    '<span class="hand" data-ref="2" data-origin="b">Other</span><em>Base resumes</em>';
  const result = prepareHandControls(source, { 1: 'Lenz', 2: 'Goethe' },
    { anchors: true, labelStarts: true, baseRef: '1' });
  assert.deepEqual(result.labels.map(({ ref, anchor }) => [ref, anchor]),
    [['1', 'hand-1'], ['2', 'hand-2'], ['1', 'hand-base-1']]);
});

test('implicit labels are opt-in and use the supplied base author rather than assuming Lenz', () => {
  const source = '<div>Base text<span class="hand" data-ref="1">Lenz</span>Base again</div>';
  assert.deepEqual(prepareHandControls(source, { 8: 'Base', 1: 'Lenz' }).labels.map(({ ref }) => ref), ['1']);
  const result = prepareHandControls(source, { 8: 'Base', 1: 'Lenz' }, { anchors: true, baseRef: '8' });
  assert.deepEqual(result.labels.map(({ ref }) => ref), ['8', '1', '8']);
});

test('letter 279: pencil writing labels Lenz, the base author Lavater, and the unknown hand', () => {
  const source = '<div><span class="pe"><span class="hand" data-ref="1" data-origin="a">Hn Pfr. Lavater</span></span></div>' +
    '<div><span class="pe"><span class="hand" data-ref="1" data-origin="a">Warum nicht bey uns?</span></span></div>' +
    '<div><span class="pe">Ich suche Poeten für morgenden Spaß,</span></div>' +
    '<div><span class="pe">Drum wandelt mein Auge von Nase zu Nas’</span></div>' +
    '<div><span class="hand" data-ref="87" data-origin="b">Hn: Wegmeister Tobler in Zürich.</span></div>';
  const names = { 1: 'Lenz', 10: 'Lavater', 87: 'Unbekannt' };
  const options = { anchors: true, labelStarts: true, baseRef: '10' };
  const result = prepareHandControls(source, names, options);
  assert.deepEqual(result.labels, [
    { ref: '1', name: 'Lenz', anchor: 'hand-1' },
    { ref: '10', name: 'Lavater', anchor: 'hand-base-1' },
    { ref: '87', name: 'Unbekannt', anchor: 'hand-2' },
  ]);
  assert.deepEqual(prepareHandControls(result.html, names, options), result);
});

test('explicit hands are collected even inside editorial wrappers', () => {
  const source = '<span class="note">Annotation <span class="hand" data-ref="2">Written text</span></span>';
  assert.deepEqual(prepareHandControls(source, { 1: 'Base', 2: 'Other' },
    { anchors: true, labelStarts: true, baseRef: '1' }).labels.map(({ ref }) => ref), ['2']);
});
