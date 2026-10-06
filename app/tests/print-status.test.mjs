import { test } from 'node:test';
import assert from 'node:assert/strict';
import { printStatus } from '../src/scripts/print-status.ts';

test('duplicate progress avoids DOM writes while the completion phase still updates at rounded 100 percent', () => {
  let writes = 0;
  const message = { set textContent(value) { this.text = value; writes++; } };
  const bar = { hidden: true, value: 0 };
  const element = { hidden: true, classList: { add() {}, remove() {} }, querySelector(selector) {
    return selector === '[data-print-message]' ? message : bar;
  } };
  const status = printStatus(element);
  status.start('Preparing');
  status.progress({ fraction: 0.9999, pages: 5 });
  const count = writes;
  status.progress({ fraction: 0.9999, pages: 5 });
  assert.equal(writes, count);
  status.progress({ fraction: 1, pages: 5 });
  assert.match(message.text, /abgeschlossen/);
  assert.equal(writes, count + 1);
  status.start('Preparing again');
  status.progress({ fraction: 1, pages: 5 });
  assert.equal(bar.hidden, false);
});
