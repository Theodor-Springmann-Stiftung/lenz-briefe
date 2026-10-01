import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFilterOptionOrder } from '../src/lib/filter-option-order.mjs';

test('selection stays in place while open, then moves to the top on close', () => {
  const order = createFilterOptionOrder(['A', 'B', 'C', 'D']);
  assert.deepEqual(order(new Set(['C'])).ordered, ['A', 'B', 'C', 'D']);
  assert.deepEqual(order(new Set(['C']), true).ordered, ['C', 'A', 'B', 'D']);
  assert.deepEqual(order(new Set(['C', 'D'])).ordered, ['C', 'A', 'B', 'D']);
  assert.deepEqual(order(new Set(['C', 'D']), true).ordered, ['C', 'D', 'A', 'B']);
});

test('deselection immediately returns a promoted option to its original position', () => {
  const order = createFilterOptionOrder(['A', 'B', 'C', 'D']);
  order(new Set(['B', 'D']), true);
  const next = order(new Set(['D']));
  assert.deepEqual(next.ordered, ['D', 'A', 'B', 'C']);
  assert.deepEqual([...next.promoted], ['D']);
  assert.deepEqual(order(new Set(['B', 'D'])).ordered, ['D', 'A', 'B', 'C']);
});

test('clearing filters restores original order and menus keep independent state', () => {
  const people = createFilterOptionOrder(['A', 'B', 'C']);
  const places = createFilterOptionOrder(['A', 'B', 'C']);
  people(new Set(['C']), true);
  assert.deepEqual(places(new Set(['B'])).ordered, ['A', 'B', 'C']);
  const cleared = people(new Set());
  assert.deepEqual(cleared.ordered, ['A', 'B', 'C']);
  assert.equal(cleared.promoted.size, 0);
});
