import test from 'node:test';
import assert from 'node:assert/strict';
import { textLossRightEdge } from '../src/lib/text-loss-placement.mjs';

test('moves the reason left of a page number and adjacent rotation mark', () => {
  const obstacles = [
    { left: 240, right: 255, top: 100, bottom: 118 },
    { left: 190, right: 230, top: 100, bottom: 118 },
  ];
  assert.equal(textLossRightEdge(270, 100, 40, obstacles), 178);
  assert.equal(textLossRightEdge(270, 100, 40, [...obstacles].reverse()), 178);
});

test('leaves the position alone when margin marks are on other lines or inside the text', () => {
  assert.equal(textLossRightEdge(270, 100, 20, [
    { left: 240, right: 255, top: 50, bottom: 70 },
    { left: 240, right: 255, top: 140, bottom: 158 },
    { left: 300, right: 340, top: 100, bottom: 120 },
  ]), 270);
});

test('accounts for a longer explanation reaching the next page label', () => {
  assert.equal(textLossRightEdge(270, 100, 70, [
    { left: 200, right: 240, top: 155, bottom: 175 },
  ]), 188);
});
