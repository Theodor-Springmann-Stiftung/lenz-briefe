import test from 'node:test';
import assert from 'node:assert/strict';
import { textLossSegments } from '../src/lib/text-loss-line.mjs';

test('leaves clearance around sidenotes and overlapping hand labels', () => {
  assert.deepEqual(textLossSegments(0, 200, 110, [
    { left: 100, right: 180, top: 30, bottom: 60 },
    { left: 105, right: 160, top: 55, bottom: 90 },
    { left: 100, right: 180, top: 150, bottom: 210 },
  ]), [{ top: 0, bottom: 24 }, { top: 96, bottom: 144 }]);
});

test('hands inside the text column do not interrupt a line outside it', () => {
  assert.deepEqual(textLossSegments(0, 100, 112, [
    { left: 0, right: 100, top: 20, bottom: 80 },
  ]), [{ top: 0, bottom: 100 }]);
});

test('omits the line when an obstacle covers its entire span', () => {
  assert.deepEqual(textLossSegments(30, 60, 110, [
    { left: 100, right: 180, top: 20, bottom: 80 },
  ]), []);
});
