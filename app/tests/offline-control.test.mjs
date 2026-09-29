import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(await readFile(new URL('../src/scripts/offline.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const flush = () => new Promise(setImmediate);
const paused = {
  enabled: true, phase: 'paused', done: 2, total: 4, bytes: 20, totalBytes: 40,
  ready: false, version: null, updatedAt: 0, error: 'network',
};

function target(properties = {}) {
  const listeners = new Map();
  return {
    hidden: false, textContent: '', ...properties,
    addEventListener: (name, callback) => listeners.set(name, callback),
    emit: (name, event = {}) => listeners.get(name)?.(event),
    setAttribute() {},
  };
}

async function control(initial = paused, replyError) {
  let status = { ...initial };
  const timers = new Map();
  const intervals = [];
  const commands = [];
  let nextTimer = 0;
  const fields = {
    '[data-offline-toggle]': target({ checked: true }),
    '[data-offline-label]': target({ textContent: 'Offline nutzen (~40 MB)' }),
    '.offline-feedback': target({ hidden: true }),
    '[data-offline-progress]': target({ hidden: true }),
    '[data-offline-retry]': target({ hidden: true }),
    '[data-offline-announcement]': target(),
  };
  const root = target({ dataset: { base: '/', production: 'true' }, querySelector: (selector) => fields[selector] });
  const document = target({ querySelector: () => root, visibilityState: 'visible' });
  const clearTimeout = (timer) => timers.delete(timer);
  const window = target({
    caches: {}, clearTimeout,
    setTimeout: (callback, delay) => { timers.set(++nextTimer, { callback, delay }); return nextTimer; },
    setInterval: (callback) => intervals.push(callback),
  });
  const worker = {
    scriptURL: 'https://edition.test/sw.js',
    postMessage(message, [port]) {
      commands.push(message);
      if (message.type === 'DISABLE') status = { ...status, enabled: false, phase: 'off' };
      port.postMessage(replyError ? { error: replyError } : { status });
    },
  };
  const registration = { scope: 'https://edition.test/', active: worker, update: async () => {} };
  const serviceWorker = target({ getRegistration: async () => registration });
  const navigator = { serviceWorker, onLine: true };
  const preferences = new Map([['lenz-offline-v1:/', 'enabled']]);
  vm.runInNewContext(source, {
    URL, DOMException, document, window, navigator, clearTimeout,
    location: { origin: 'https://edition.test' }, isSecureContext: true,
    localStorage: { getItem: (key) => preferences.get(key), setItem: (key, value) => preferences.set(key, value) },
    MessageChannel: class {
      port1 = { close() {} };
      port2 = { postMessage: (data) => queueMicrotask(() => this.port1.onmessage({ data })) };
    },
  });
  await flush();
  return {
    commands, timers, intervals, window, document, navigator,
    checkbox: fields['[data-offline-toggle]'], label: fields['[data-offline-label]'], retry: fields['[data-offline-retry]'],
    async tick() {
      assert.equal(timers.size, 1, 'Only one automatic retry should be scheduled');
      const [id, { callback, delay }] = [...timers][0];
      timers.delete(id);
      callback();
      await flush();
      return delay;
    },
    async broadcast(next) {
      status = { ...status, ...next };
      serviceWorker.emit('message', { data: { type: 'lenz:offline-status', scope: registration.scope, status } });
      await flush();
    },
    async reconnect() { navigator.onLine = true; window.emit('online'); await flush(); },
  };
}

test('offers Fortsetzen only after five automatic resume attempts, with increasing delays', async () => {
  const ui = await control();
  assert.match(ui.label.textContent, /Wird fortgesetzt.*50 %/);
  assert.equal(ui.commands.length, 1);
  const delays = [];
  for (let attempt = 0; attempt < 5; attempt++) {
    assert.equal(ui.retry.hidden, true);
    // Repeated broadcasts and visibility checks must not duplicate retries.
    await ui.broadcast(paused);
    ui.document.emit('visibilitychange');
    await flush();
    delays.push(await ui.tick());
  }
  assert.deepEqual(delays, [5000, 10000, 20000, 40000, 60000]);
  assert.equal(ui.commands.length, 6);
  assert.equal(ui.retry.hidden, false);
  assert.equal(ui.retry.textContent, 'Fortsetzen');
  assert.equal(ui.label.textContent, 'Pausiert · 50 %');
  assert.equal(ui.timers.size, 0);
  ui.intervals[0]();
  await flush();
  assert.equal(ui.commands.length, 6, 'Periodic checks must respect the retry limit');
  ui.retry.emit('click');
  await flush();
  assert.equal(ui.retry.hidden, true);
  assert.equal(await ui.tick(), 5000, 'Manual continuation starts a fresh recovery budget');
});

test('progress resets consecutive failures and completion cancels a pending resume', async () => {
  const ui = await control();
  await ui.tick();
  await ui.tick();
  await ui.broadcast({ phase: 'downloading', done: 3, bytes: 30, error: null });
  assert.equal(ui.label.textContent, 'Download · 75 %');
  assert.equal(ui.timers.size, 0);
  await ui.broadcast({ phase: 'paused', error: 'network' });
  assert.equal(await ui.tick(), 5000);
  await ui.broadcast({ phase: 'ready', done: 4, bytes: 40, ready: true, error: null });
  assert.equal(ui.label.textContent, 'Offline verfügbar');
  assert.equal(ui.retry.hidden, true);
  assert.equal(ui.timers.size, 0);
});

test('going offline waits for connectivity and reconnecting resumes without a click', async () => {
  const ui = await control();
  ui.navigator.onLine = false;
  ui.window.emit('offline');
  assert.equal(ui.timers.size, 0);
  assert.match(ui.label.textContent, /Warte auf Verbindung/);
  assert.equal(ui.retry.hidden, true);
  await ui.reconnect();
  assert.equal(ui.commands.length, 2);
  assert.equal(await ui.tick(), 5000);
});

test('unchecking cancels recovery and stale worker messages cannot restart it', async () => {
  const ui = await control();
  ui.checkbox.checked = false;
  const change = ui.checkbox.emit('change');
  assert.equal(ui.label.textContent, 'Wird entfernt …');
  await change;
  assert.equal(ui.timers.size, 0);
  assert.equal(ui.label.textContent, 'Offline nutzen (~40 MB)');
  await ui.broadcast(paused);
  assert.equal(ui.checkbox.checked, false);
  assert.equal(ui.timers.size, 0);
});

test('storage exhaustion requires manual action and never schedules automatic retries', async () => {
  const ui = await control({ ...paused, phase: 'error', error: 'quota' });
  assert.equal(ui.label.textContent, 'Speicher voll');
  assert.equal(ui.retry.hidden, false);
  assert.equal(ui.retry.textContent, 'Erneut versuchen');
  await ui.reconnect();
  ui.intervals[0]();
  await flush();
  assert.equal(ui.commands.length, 1);
  assert.equal(ui.timers.size, 0);
});

test('worker communication failures also recover automatically with the same five-attempt limit', async () => {
  const ui = await control(paused, 'NetworkError');
  for (let attempt = 0; attempt < 5; attempt++) {
    assert.equal(ui.retry.hidden, true);
    await ui.tick();
  }
  assert.equal(ui.retry.hidden, false);
  assert.equal(ui.retry.textContent, 'Fortsetzen');
  assert.equal(ui.timers.size, 0);
});
