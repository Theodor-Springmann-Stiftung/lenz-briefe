import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLayoutScheduler } from '../src/lib/layout-scheduler.ts';

function harness() {
  const frames = [];
  const scheduler = createLayoutScheduler((callback) => frames.push(callback));
  return { scheduler, frames, flush: () => frames.shift()() };
}

test('coalesces events and arranges margins before measuring and painting decorations', () => {
  const { scheduler, frames, flush } = harness();
  const calls = [];
  const decorate = scheduler.register(() => {
    calls.push('measure');
    return () => calls.push('paint');
  });
  const arrange = scheduler.register(() => {
    calls.push('arrange');
  }, 'arrange');
  scheduler.register(() => {
    calls.push('measure second');
    return () => calls.push('paint second');
  });
  decorate();
  arrange();
  scheduler.scheduleAll();
  assert.equal(frames.length, 1);
  flush();
  assert.deepEqual(calls, ['arrange', 'measure', 'measure second', 'paint', 'paint second']);
  calls.length = 0;
  arrange();
  flush();
  assert.deepEqual(calls, ['arrange', 'measure', 'measure second', 'paint', 'paint second']);
});

test('an interaction updates only its decoration without rearranging margins', () => {
  const { scheduler, flush } = harness();
  const calls = [];
  scheduler.register(() => {
    calls.push('arrange');
  }, 'arrange');
  const highlight = scheduler.register(() => {
    calls.push('highlight');
  });
  scheduler.register(() => {
    calls.push('spine');
  });
  flush();
  calls.length = 0;
  highlight();
  highlight();
  flush();
  assert.deepEqual(calls, ['highlight']);
});

test('updates requested during a frame run in the following frame', () => {
  const { scheduler, frames, flush } = harness();
  let count = 0;
  const schedule = scheduler.register(() => {
    if (++count === 1) schedule();
  });
  flush();
  assert.equal(count, 1);
  assert.equal(frames.length, 1);
  flush();
  assert.equal(count, 2);
  assert.equal(frames.length, 0);
});
