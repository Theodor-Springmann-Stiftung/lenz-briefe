import {test} from 'node:test';
import assert from 'node:assert/strict';
import {placeMarginItem, sidenoteOrder} from '../src/lib/margin-placement.mjs';

test('sidenotes sort top, sides, bottom while retaining order within each group', () => {
  const positions = ['bottom left', 'left', 'top right', 'right', 'top', 'bottom', 'top left', 'bottom right'];
  assert.deepEqual(positions.sort((a,b) => sidenoteOrder(a) - sidenoteOrder(b)),
    ['top right', 'top', 'top left', 'left', 'right', 'bottom left', 'bottom', 'bottom right']);
});

test('an oversized note stays at its page start and continues across the boundary', () => {
  assert.deepEqual(placeMarginItem(100, 300, -18, 200), {top:100, bottom:400, overflow:true});
});
test('next-page notes follow overflow in order without reserving space or jumping pages', () => {
  const first = placeMarginItem(100, 300, -18, 200);
  const next = placeMarginItem(200, 80, first.bottom, 600, 6);
  assert.deepEqual(next, {top:406, bottom:486, overflow:false});
  assert.deepEqual(placeMarginItem(600, 50, next.bottom, 800), {top:600, bottom:650, overflow:false});
});
test('hand labels follow a crossing note without forcing it to move', () => {
  const note = placeMarginItem(0, 500, -18, 200);
  assert.deepEqual(placeMarginItem(200, 20, note.bottom), {top:518, bottom:538, overflow:false});
});
