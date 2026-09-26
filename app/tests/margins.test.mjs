import {test} from 'node:test';
import assert from 'node:assert/strict';
import {placeMarginItem, sidenoteOrder} from '../src/lib/margin-placement.mjs';

test('sidenotes sort top, sides, bottom while retaining order within each group', () => {
  const positions = ['bottom left', 'left', 'top right', 'right', 'top', 'bottom', 'top left', 'bottom right'];
  assert.deepEqual(positions.sort((a,b) => sidenoteOrder(a) - sidenoteOrder(b)),
    ['top right', 'top', 'top left', 'left', 'right', 'bottom left', 'bottom', 'bottom right']);
});

test('an oversized note stays at its page start and continues across the boundary', () => {
  assert.deepEqual(placeMarginItem(100, 300, [], 200), {top:100, bottom:400, overflow:true});
});
test('next-page notes follow overflow in order without reserving space or jumping pages', () => {
  const first = placeMarginItem(100, 300, [], 200);
  const occupied = [{...first, gap:6}];
  const next = placeMarginItem(200, 80, occupied, 600);
  assert.deepEqual(next, {top:406, bottom:486, overflow:false});
  assert.deepEqual(placeMarginItem(600, 50, [...occupied, {...next, gap:6}], 800), {top:600, bottom:650, overflow:false});
});
test('a tall note moves past fixed hand labels instead of displacing them', () => {
  const hands = [{top:200, bottom:220, gap:18}, {top:400, bottom:420, gap:18}];
  assert.deepEqual(placeMarginItem(0, 500, hands), {top:438, bottom:938, overflow:false});
  assert.equal(hands[0].top, 200);
  assert.equal(hands[1].top, 400);
});

test('a note fills the first gap large enough for its entire height and clearance', () => {
  const hands = [{top:0, bottom:20, gap:18}, {top:200, bottom:220, gap:18}];
  assert.equal(placeMarginItem(0, 144, hands).top, 38);
  assert.equal(placeMarginItem(0, 145, hands).top, 238);
});

test('a later short note can fill a gap a taller note could not use', () => {
  const occupied = [{top:200, bottom:220, gap:18}];
  const tall = placeMarginItem(0, 300, occupied);
  occupied.push({...tall, gap:6});
  assert.equal(tall.top, 238);
  assert.equal(placeMarginItem(0, 100, occupied).top, 0);
  assert.equal(placeMarginItem(250, 100, occupied).top, 544);
});
