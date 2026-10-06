import { test } from 'node:test';
import assert from 'node:assert/strict';
import { printTimeout, printWatchdog } from '../src/lib/print-timeout.mjs';

test('pagination allows five minutes minimum and scales for large selections', () => {
  assert.equal(printTimeout(), 300_000);
  assert.equal(printTimeout(20), 300_000);
  assert.equal(printTimeout(300), 3_000_000);
});

test('advancing pages or content extend the deadline; duplicate or regressing progress does not', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let expired = 0;
  const watchdog = printWatchdog(1000, () => expired++);
  t.mock.timers.tick(900);
  watchdog.progress({ fraction: 0.1, pages: 0 });
  t.mock.timers.tick(900);
  assert.equal(expired, 0);
  watchdog.progress({ fraction: 0.1, pages: 1 });
  t.mock.timers.tick(900);
  watchdog.progress({ fraction: 0.1, pages: 1 });
  watchdog.progress({ fraction: 0.05, pages: 0 });
  t.mock.timers.tick(100);
  assert.equal(expired, 1);
  watchdog.progress({ fraction: 1, pages: 50 });
  t.mock.timers.tick(5000);
  assert.equal(expired, 1);
});

test('completion cancels the deadline and ignores subsequent notifications', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let expired = false;
  const watchdog = printWatchdog(1000, () => { expired = true; });
  watchdog.stop();
  watchdog.progress({ fraction: 1, pages: 10 });
  t.mock.timers.tick(2000);
  assert.equal(expired, false);
});
