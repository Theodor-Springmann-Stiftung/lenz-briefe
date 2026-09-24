import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {createExportQueue} from '../scripts/watch-edition.mjs';

async function until(predicate) {
  for (let i = 0; i < 200; i++) {
    if (predicate()) return;
    await delay(5);
  }
  assert.fail('Timed out waiting for export queue');
}

test('rapid saves coalesce, exports never overlap, and edits during export rerun before reload', async t => {
  const pending = [];
  let reloads = 0;
  const queue = createExportQueue({delay:5, run:() => new Promise(resolve => pending.push(resolve)),
    success:() => reloads++, failure:assert.fail});
  t.after(() => queue.stop());
  queue.schedule(); queue.schedule(); queue.schedule();
  await until(() => pending.length === 1);
  queue.schedule(); queue.schedule();
  await delay(20);
  assert.equal(pending.length, 1);
  pending[0]();
  await until(() => pending.length === 2);
  assert.equal(reloads, 0);
  pending[1]();
  await until(() => reloads === 1);
  assert.equal(pending.length, 2);
});

test('failed exports report errors and a later save recovers', async t => {
  let runs = 0, errors = 0, reloads = 0;
  const queue = createExportQueue({delay:0, run:async () => { if (++runs === 1) throw new Error('Invalid XML'); },
    success:() => reloads++, failure:() => errors++});
  t.after(() => queue.stop());
  queue.schedule();
  await until(() => errors === 1);
  assert.equal(reloads, 0);
  queue.schedule();
  await until(() => reloads === 1);
  assert.equal(runs, 2);
});

test('shutdown cancels pending work and prevents late reloads', async () => {
  let runs = 0, reloads = 0;
  const queue = createExportQueue({delay:5, run:async () => runs++, success:() => reloads++, failure:assert.fail});
  queue.schedule(); queue.stop();
  await delay(20);
  assert.equal(runs, 0);
  let finish;
  const active = createExportQueue({delay:0, run:() => new Promise(resolve => { finish = resolve; }),
    success:() => reloads++, failure:assert.fail});
  active.schedule();
  await until(() => finish);
  active.stop(); finish();
  await delay(10);
  assert.equal(reloads, 0);
});
