import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupHandLabelLines, handLabelNames, handRefsOnLine } from '../src/lib/hand-label-groups.mjs';

test('shared labels use the last word of each name, once and in source order', () => {
  assert.deepEqual(handLabelNames(['Philipp Seidel', 'Jakob Michael Reinhold Lenz']), ['Seidel', 'Lenz']);
  assert.deepEqual(handLabelNames(['Johann Wolfgang Goethe', 'Jakob Michael Reinhold Lenz', 'Johann Wolfgang Goethe']), ['Goethe', 'Lenz']);
  assert.deepEqual(handLabelNames([' Philipp  Seidel ', 'Lenz']), ['Seidel', 'Lenz']);
});

test('a single writer retains the full name, including repeated starts on that line', () => {
  assert.deepEqual(handLabelNames(['Jakob Michael Reinhold Lenz']), ['Jakob Michael Reinhold Lenz']);
  assert.deepEqual(handLabelNames(['Philipp Seidel', 'Philipp Seidel']), ['Philipp Seidel']);
});

test('same-line font differences merge without combining subsequent lines or reordering writers', () => {
  const seidel = { name: 'Philipp Seidel', target: 101 };
  const laterSeidel = { name: 'Philipp Seidel', target: 133 };
  const lenz = { name: 'Jakob Michael Reinhold Lenz', target: 100 };
  assert.deepEqual(groupHandLabelLines([seidel, laterSeidel, lenz]), [[seidel, lenz], [laterSeidel]]);
});

test('a line includes a continuing writer without a fresh start marker', () => {
  assert.deepEqual(handRefsOnLine([{ ref: '25', target: 133 }], [
    { ref: '25', tops: [133] },
    { ref: '1', tops: [101, 134] },
    { ref: '1', tops: [134] },
    { ref: '12', tops: [167] },
  ]), ['25', '1']);
});

test('single-writer lines do not pick up a writer on the preceding or following line', () => {
  assert.deepEqual(handRefsOnLine([{ ref: '25', target: 133 }], [
    { ref: '1', tops: [101, 167] },
    { ref: '25', tops: [133] },
  ]), ['25']);
});
