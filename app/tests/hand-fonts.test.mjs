import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handFonts} from '../src/lib/hand-fonts.mjs';

test('three co-senders have distinct hands, with only Lenz in Source Serif', () => {
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

test('being a sender does not exempt another tagged writer', () => {
  assert.equal(handFonts(['3'], new Set(['3'])).get('3'), 'var(--font-hand)');
});

test('repeated tags keep one font and excess writers cannot silently share a font', () => {
  assert.equal(handFonts(['3', '3'], new Set()).size, 1);
  assert.throws(() => handFonts(['3', '4', '5'], new Set()), /another distinct/);
});
