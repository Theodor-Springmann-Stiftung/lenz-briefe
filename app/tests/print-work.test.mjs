import { test } from 'node:test';
import assert from 'node:assert/strict';
import { printCheckpoint, yieldPrintWork } from '../src/lib/print-work.mjs';

function schedulerForTest(t, value) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'scheduler');
  Object.defineProperty(globalThis, 'scheduler', { configurable: true, value });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'scheduler', descriptor);
    else delete globalThis.scheduler;
  });
}

test('checkpoints share a work budget and renew it after yielding', async (t) => {
  let now = 0;
  let yields = 0;
  t.mock.method(performance, 'now', () => now);
  schedulerForTest(t, { yield: async () => { yields++; } });
  const checkpoint = printCheckpoint();
  assert.equal(checkpoint(), undefined);
  now = 20;
  await checkpoint();
  assert.equal(yields, 1);
  assert.equal(checkpoint(), undefined);
  await checkpoint(true);
  assert.equal(yields, 2);
});

test('the fallback yields to a browser task rather than only to microtasks', async (t) => {
  schedulerForTest(t, undefined);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let finished = false;
  const pending = yieldPrintWork().then(() => { finished = true; });
  await Promise.resolve();
  assert.equal(finished, false);
  t.mock.timers.tick(0);
  await pending;
  assert.equal(finished, true);
});
