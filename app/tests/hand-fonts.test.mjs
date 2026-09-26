import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handFonts, handKeyRefs} from '../src/lib/hand-fonts.mjs';

test('letter 20 lists its implicit base hand before the tagged additional writer', () => {
  const refs = handKeyRefs(['87'], new Set(['8']));
  assert.deepEqual(refs, ['8', '87']);
  assert.deepEqual([...handFonts(refs, new Set(['8']))], [
    ['8', 'var(--font-serif)'], ['87', 'var(--font-hand)'],
  ]);
  assert.deepEqual(handKeyRefs(['1', '9'], new Set(['9', '1'])), ['9', '1']);
  assert.deepEqual(handKeyRefs([], new Set(['8'])), []);
  assert.deepEqual(handKeyRefs(['1', '12', '18'], new Set(['1', '12', '18']), ['18', '1', '12']), ['18', '1', '12']);
  assert.deepEqual(handKeyRefs(['87'], new Set(['8']), ['87', '8']), ['87', '8']);
});

test('three co-senders have distinct hands, with the first sender in Source Serif', () => {
  assert.deepEqual([...handFonts(['18', '1', '12'], new Set(['1', '12', '18']))], [
    ['1', 'var(--font-serif)'],
    ['12', 'var(--font-hand)'],
    ['18', 'var(--font-hand-second)'],
  ]);
});

test('Lenz as a non-sender and another writer both differ from the implicit base hand', () => {
  assert.deepEqual([...handFonts(['87', '1'], new Set(['10']))], [
    ['1', 'var(--font-hand)'], ['87', 'var(--font-hand-second)'],
  ]);
});

test('letter 161 uses the first sender as the base hand when Lenz is not a sender', () => {
  assert.deepEqual([...handFonts(['9', '11'], new Set(['9', '11']))], [
    ['9', 'var(--font-serif)'], ['11', 'var(--font-hand)'],
  ]);
});

test('base hand follows sender order without special priority for Lenz', () => {
  assert.equal(handFonts(['9', '11'], new Set(['11', '9'])).get('11'), 'var(--font-serif)');
  assert.deepEqual([...handFonts(['1', '9'], new Set(['9', '1']))], [
    ['1', 'var(--font-hand)'], ['9', 'var(--font-serif)'],
  ]);
  assert.equal(handFonts(['3'], new Set(['3'])).get('3'), 'var(--font-serif)');
});

test('repeated tags keep one font and excess writers cannot silently share a font', () => {
  assert.equal(handFonts(['3', '3'], new Set()).size, 1);
  assert.throws(() => handFonts(['3', '4', '5'], new Set()), /another distinct/);
});
