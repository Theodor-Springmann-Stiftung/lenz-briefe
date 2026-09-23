import {test} from 'node:test';
import assert from 'node:assert/strict';
import {noteTarget, freePosition, sidenoteOrder} from '../src/lib/margin-placement.mjs';

test('sidenotes sort top, sides, bottom while retaining order within each group', () => {
  const positions = ['bottom left', 'left', 'top right', 'right', 'top', 'bottom', 'top left', 'bottom right'];
  assert.deepEqual(positions.sort((a,b) => sidenoteOrder(a) - sidenoteOrder(b)),
    ['top right', 'top', 'top left', 'left', 'right', 'bottom left', 'bottom', 'bottom right']);
});

test('notes end at the page bottom, accounting for the whole group height', () => {
  assert.equal(noteTarget(100, 1000, 200), 782);
  const groupHeight = 200 + 18 + 150;
  assert.equal(noteTarget(100, 1000, groupHeight) + groupHeight, 982);
  assert.equal(noteTarget(100, 200, 300), 100);
});
test('page numbers and other notes remain clear of a note', () => {
  const occupied = [{top:100, bottom:120}, {top:450, bottom:650}, {top:1000, bottom:1020}];
  assert.equal(freePosition(100, 200, 100, 1000, occupied), 138);
  assert.equal(freePosition(782, 200, 100, 1000, occupied), 782);
  assert.equal(freePosition(450, 200, 100, 1000, occupied), 232);
});
test('oversized notes survive without overlapping occupied positions', () => {
  assert.equal(freePosition(0, 500, 0, 200, [{top:200, bottom:220}]), 238);
});
test('strict placement moves a whole note rather than crossing a page boundary', () => {
  assert.equal(freePosition(100, 150, 100, 200, [], false), null);
  assert.equal(freePosition(100, 80, 100, 200, [], false), 100);
});
test('overflow uses free space before the next page’s native notes', () => {
  const occupied = [{top:300, bottom:320}, {top:650, bottom:780}];
  assert.equal(freePosition(300, 200, 300, 800, occupied, false), 338);
  assert.equal(freePosition(300, 400, 300, 800, occupied, false), null);
});
