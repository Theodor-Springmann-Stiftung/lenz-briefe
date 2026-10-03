import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeMapViews } from '../src/lib/place-map.mjs';
import { MAP } from '../src/lib/correspondence-map.mjs';

test('place portraits have three increasing zoom levels and keep the dot and map within the frame', () => {
  for (const place of [{x:500,y:500}, {x:10,y:10}, {x:1390,y:1190}]) {
    const views = placeMapViews(place);
    assert.deepEqual(views.map(view => view.scale), [0.2, 0.4, 0.8]);
    for (const fit of views) {
      const x = place.x * fit.scale + fit.x, y = place.y * fit.scale + fit.y;
      assert.ok(x >= 0 && x <= 120 && y >= 0 && y <= 150);
      assert.ok(fit.x <= 0 && fit.y <= 0);
      assert.ok(fit.x + MAP.width * fit.scale >= 120 - 1e-8);
      assert.ok(fit.y + MAP.height * fit.scale >= 150 - 1e-8);
    }
  }
});
