import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectLegendTargets} from '../src/lib/legend-targets.mjs';

for (const [firstKind, secondKind] of [['page-marker', 'page-number'], ['hand-text', 'hand-name']]) {
  test(`${firstKind} chooses its matching partner over a closer unrelated one`, () => {
    const first = {kind:firstKind, pairKey:'1', score:1};
    const unrelated = {kind:secondKind, pairKey:'2', score:2};
    const matching = {kind:secondKind, pairKey:'1', score:20};
    assert.deepEqual(selectLegendTargets([matching, unrelated, first], [firstKind, secondKind]), [first, matching]);
  });

  test(`${firstKind} never presents an unrelated or unidentified pair`, () => {
    const first = {kind:firstKind, pairKey:'1', score:1};
    const unrelated = {kind:secondKind, pairKey:'2', score:2};
    assert.deepEqual(selectLegendTargets([first, unrelated], [firstKind, secondKind]), [first]);
    assert.equal(selectLegendTargets([{kind:firstKind, score:1}, {kind:secondKind, score:2}], [firstKind, secondKind]).length, 1);
    assert.deepEqual(selectLegendTargets([unrelated], [firstKind, secondKind]), [unrelated]);
  });
}

test('a complete pair takes precedence over an isolated nearby example', () => {
  const nearest = {kind:'page-marker', pairKey:'page-1', score:1};
  const marker = {kind:'page-marker', pairKey:'page-a', score:10};
  const number = {kind:'page-number', pairKey:'page-a', score:11};
  assert.deepEqual(selectLegendTargets([nearest, marker, number], ['page-marker', 'page-number']), [marker, number]);
  assert.deepEqual(selectLegendTargets([marker, nearest]), [nearest]);
  assert.deepEqual(selectLegendTargets([], ['page-marker', 'page-number']), []);
});
