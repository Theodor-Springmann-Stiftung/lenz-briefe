import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectionDescription } from '../src/lib/print-selection.mjs';

test('print cover describes OR within categories and AND between categories', () => {
  assert.equal(selectionDescription(['Person A', 'Person B'], ['Ort A', 'Ort B']),
    'Korrespondenz mit (Person A ODER Person B) UND Ortsbezug (Ort A ODER Ort B)');
  assert.equal(selectionDescription(['Person A'], []), 'Korrespondenz mit Person A');
  assert.equal(selectionDescription([], ['Ort A']), 'Ortsbezug Ort A');
  assert.equal(selectionDescription([], []), '');
});
