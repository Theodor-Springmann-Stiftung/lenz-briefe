import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { preview } from 'astro';
import { createOfflineWorker } from '../src/offline/worker.mjs';
import offlineEdition, { buildOfflineEdition } from '../scripts/offline-build.mjs';
import { licenseFileUrl } from '../src/lib/licenses.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const address = (request) => typeof request === 'string' ? request : request.url;

async function waitForWorkerEvent(event, operation, description) {
  let timer;
  try {
    await Promise.race([
      event,
      operation.then(() => { throw new Error(`Worker finished before ${description}`); }),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out waiting for ${description}`)), 5000);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

class MemoryCaches {
  stores = new Map();
  failPut = false;
  async open(name) {
    if (!this.stores.has(name)) this.stores.set(name, new Map());
    const store = this.stores.get(name);
    return {
      match: async (request) => store.get(address(request))?.clone(),
      put: async (request, response) => {
        if (this.failPut && name.endsWith(':files')) throw new DOMException('Full', 'QuotaExceededError');
        store.set(address(request), response.clone());
      },
      keys: async () => [...store.keys()].map((url) => new Request(url)),
      delete: async (request) => store.delete(address(request)),
    };
  }
  async keys() { return [...this.stores.keys()]; }
  async delete(name) { return this.stores.delete(name); }
}

function fixture(files, version = '1') {
  return {
    schema: 1, version: hash(version),
    entries: Object.entries(files).map(([url, text]) => ({
      url, hash: hash(text), bytes: Buffer.byteLength(text), page: url.endsWith('/'),
    })),
  };
}

function environment(initialFiles, { base = '/', caches = new MemoryCaches() } = {}) {
  let files = initialFiles;
  let manifest = fixture(files);
  let offline = false;
  let failures = new Set();
  let overrides = {};
  const requests = [];
  const retryDelays = [];
  const messages = [];
  const listeners = new Map();
  let unregistered = false;
  const worker = {
    caches, crypto: webcrypto, clearTimeout,
    setTimeout: (callback, delay) => {
      // Run backoff waits promptly in tests; keep request deadlines intact.
      if (delay < 20000) { retryDelays.push(delay); return setTimeout(callback, 0); }
      return setTimeout(callback, delay);
    },
    registration: { scope: `https://edition.test${base}`, unregister: async () => { unregistered = true; } },
    clients: { claim: async () => {}, matchAll: async () => [{ url: `https://edition.test${base}`, postMessage: (message) => messages.push(message) }] },
    addEventListener: (name, listener) => listeners.set(name, listener),
    fetch: async (request, options = {}) => {
      const url = new URL(address(request));
      requests.push(url.pathname);
      if (offline || failures.has(url.pathname) || options.signal?.aborted) throw new TypeError('Network unavailable');
      if (url.pathname === `${base}offline-manifest.json`) return Response.json(manifest);
      const body = overrides[url.pathname] ?? files[url.pathname];
      if (body === undefined) return new Response('Not found', { status: 404 });
      return new Response(body, { headers: { 'Content-Type': url.pathname.endsWith('/') ? 'text/html' : 'text/plain' } });
    },
  };
  return {
    worker, requests, retryDelays, messages, caches, listeners,
    restart: () => createOfflineWorker(worker),
    deploy: (next, version) => { files = next; manifest = fixture(next, version); },
    disconnect: () => { offline = true; },
    reconnect: () => { offline = false; },
    fail: (urls) => { failures = new Set(urls); },
    override: (values) => { overrides = values; },
    unregistered: () => unregistered,
  };
}

test('build generates stable versions, deployment-prefixed page URLs, all assets, and an executable worker', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'lenz-offline-'));
  try {
    await mkdir(path.join(directory, 'briefe/1'), { recursive: true });
    await mkdir(path.join(directory, '_astro'));
    await writeFile(path.join(directory, 'index.html'), 'Index');
    await writeFile(path.join(directory, 'briefe/1/index.html'), 'Brief');
    await writeFile(path.join(directory, '_astro/font.woff2'), 'font');
    await writeFile(path.join(directory, 'Grüße.txt'), 'Grüße');
    const first = await buildOfflineEdition(directory, '/edition/');
    assert.deepEqual(first.entries.map((entry) => entry.url), [
      '/edition/_astro/font.woff2', '/edition/Gr%C3%BC%C3%9Fe.txt', '/edition/', '/edition/briefe/1/',
    ]);
    assert.equal((await buildOfflineEdition(directory, '/edition/')).version, first.version);
    await writeFile(path.join(directory, 'briefe/1/index.html'), 'Korrigierter Brief');
    const next = await buildOfflineEdition(directory, '/edition/');
    assert.notEqual(next.version, first.version);
    assert.equal(next.entries[0].hash, first.entries[0].hash);
    const listeners = [];
    vm.runInNewContext(await readFile(path.join(directory, 'sw.js'), 'utf8'), {
      URL, self: { registration: { scope: 'https://edition.test/edition/' }, addEventListener: (type) => listeners.push(type) },
    });
    assert.deepEqual(listeners, ['activate', 'fetch', 'message']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('offline edition includes unvisited pages and assets; page query parameters share cached HTML', async () => {
  const env = environment({ '/': 'Index', '/briefe/1/': 'Brief', '/edition/regeln/': 'Regeln', '/search.json': 'Search' });
  const runtime = env.restart();
  assert.equal((await runtime.status()).enabled, false);
  await runtime.enable();
  await runtime.synchronize(true);
  assert.equal((await runtime.status()).phase, 'ready');
  assert.equal((await runtime.status()).done, 4);
  env.disconnect();
  for (const [url, text] of [
    ['/?person=2&group=all', 'Index'], ['/briefe/1/?correspondent=2', 'Brief'],
    ['/briefe/1/index.html?q=Test', 'Brief'], ['/edition/regeln/', 'Regeln'], ['/search.json', 'Search'],
  ]) assert.equal(await (await runtime.respond(new Request(`https://edition.test${url}`))).text(), text);
});

test('built pages identify their edition while manifest hashes verify the stamped bytes', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'lenz-offline-version-'));
  try {
    await writeFile(path.join(directory, 'index.html'), '<span data-offline-version="__OFFLINE_VERSION__">Grüße</span>');
    await writeFile(path.join(directory, 'font.woff2'), 'Font');
    const first = await buildOfflineEdition(directory);
    const initialPage = await readFile(path.join(directory, 'index.html'));
    assert.ok(initialPage.includes(`data-offline-version="${first.version}"`));
    assert.equal(hash(initialPage), first.entries.find((entry) => entry.page).hash);
    assert.equal(initialPage.length, first.entries.find((entry) => entry.page).bytes);
    assert.deepEqual(await buildOfflineEdition(directory), first);
    // Asset-only changes also require an old document to reload.
    await writeFile(path.join(directory, 'font.woff2'), 'Revised font');
    const next = await buildOfflineEdition(directory);
    assert.notEqual(next.version, first.version);
    const nextPage = await readFile(path.join(directory, 'index.html'));
    assert.ok(nextPage.includes(`data-offline-version="${next.version}"`));
    assert.ok(!nextPage.includes(first.version));
    assert.equal(hash(nextPage), next.entries.find((entry) => entry.page).hash);
    assert.deepEqual(await buildOfflineEdition(directory), next);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('offline manifest includes source notices and the license page, and downloads intact from Astro preview', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'lenz-offline-preview-'));
  let server;
  try {
    const output = path.join(directory, 'dist');
    await mkdir(path.join(output, 'licenses/npm/@scope__name@1.0'), { recursive: true });
    await mkdir(path.join(output, 'edition/lizenzen'), { recursive: true });
    await mkdir(path.join(directory, 'src/pages'), { recursive: true });
    await writeFile(path.join(output, 'index.html'), '<h1 data-offline-version="__OFFLINE_VERSION__">Edition</h1>');
    await writeFile(path.join(output, 'edition/lizenzen/index.html'), '<h1>Lizenzen</h1>');
    const notices = ['npm/@scope__name@1.0/LICENSE', 'npm/@scope__name@1.0/package-metadata.json'];
    for (const file of notices) await writeFile(path.join(output, 'licenses', file), 'Notice');
    await writeFile(path.join(output, 'Grüße.txt'), 'Grüße');
    let manifest = await buildOfflineEdition(output, '/edition/');
    assert.equal(manifest.entries.length, 5);
    assert.ok(manifest.entries.some((entry) => entry.url === '/edition/edition/lizenzen/' && entry.page));
    for (const file of notices) {
      const url = '/edition/licenses/' + file;
      assert.ok(manifest.entries.some((entry) => entry.url === url && !entry.page));
    }
    // Revised notices must also trigger an offline edition update.
    await writeFile(path.join(output, 'licenses', notices[0]), 'Revised notice');
    const revised = await buildOfflineEdition(output, '/edition/');
    assert.notEqual(revised.version, manifest.version);
    manifest = revised;
    server = await preview({
      root: directory, configFile: false, base: '/edition/', trailingSlash: 'always',
      integrations: [offlineEdition()], server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent',
    });
    for (const entry of manifest.entries) {
      const response = await fetch(`http://127.0.0.1:${server.port}${entry.url}`, { redirect: 'error' });
      assert.equal(response.status, 200, entry.url);
      const body = Buffer.from(await response.arrayBuffer());
      assert.equal(hash(body), entry.hash, entry.url);
      assert.equal(body.length, entry.bytes, entry.url);
    }
    const files = Object.fromEntries(await Promise.all(manifest.entries.map(async (entry) => [
      entry.url,
      await (await fetch(`http://127.0.0.1:${server.port}${entry.url}`)).text(),
    ])));
    const env = environment(files, { base: '/edition/' });
    const runtime = env.restart();
    await runtime.enable();
    await runtime.synchronize(true);
    assert.equal((await runtime.status()).phase, 'ready');
    env.disconnect();
    for (const file of notices) {
      const url = licenseFileUrl(file, '/edition/');
      const response = await runtime.respond(new Request(`https://edition.test${url}`));
      assert.equal(await response.text(), files[url]);
    }
  } finally {
    await server?.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

test('persistent failures pause after bounded retries and resume without redownloading saved files', async () => {
  const env = environment({ '/': 'Index', '/a/': 'A', '/b/': 'B', '/c/': 'C', '/d/': 'D', '/e/': 'E' });
  let runtime = env.restart();
  env.fail(['/b/']);
  await runtime.enable();
  await runtime.synchronize(true);
  const before = await runtime.status();
  assert.equal(before.phase, 'paused');
  assert.equal(env.requests.filter((url) => url === '/b/').length, 4);
  assert.deepEqual(env.retryDelays, [1000, 2000, 4000]);
  assert.ok(before.done > 0 && before.done < before.total);
  const saved = [...env.caches.stores.values()].flatMap((store) => [...store.keys()])
    .filter((url) => url.includes('__offline_revision')).map((url) => new URL(url).pathname);
  env.fail([]);
  runtime = env.restart();
  env.requests.length = 0;
  const resumed = runtime.synchronize(true);
  assert.equal((await runtime.status()).phase, 'checking');
  await resumed;
  assert.equal((await runtime.status()).phase, 'ready');
  assert.ok(saved.every((url) => !env.requests.includes(url)));
  assert.ok(env.requests.includes('/b/'));
});

for (const failure of ['connection reset', 'HTTP error', 'interrupted response body']) {
  test(`automatically retries after ${failure} without restarting completed files`, async () => {
    const env = environment({ '/': 'Index', '/a/': 'A', '/b/': 'B' });
    const fetch = env.worker.fetch;
    let attempts = 0;
    env.worker.fetch = async (request, options) => {
      if (new URL(address(request)).pathname === '/a/' && ++attempts < 3) {
        if (failure === 'connection reset') throw new TypeError('Connection reset');
        if (failure === 'HTTP error') return new Response('Temporary failure', { status: 503 });
        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('partial'));
            controller.error(new TypeError('Connection reset while reading'));
          },
        }));
      }
      return fetch(request, options);
    };
    const runtime = env.restart();
    await runtime.enable();
    await runtime.synchronize(true);
    assert.equal(attempts, 3);
    assert.deepEqual(env.retryDelays, [1000, 2000]);
    assert.equal((await runtime.status()).ready, true);
    assert.equal((await runtime.status()).done, 3);
    assert.equal(env.requests.filter((url) => url === '/').length, 1);
    assert.equal(env.requests.filter((url) => url === '/b/').length, 1);
    assert.ok(!env.messages.some(({ status }) => status.phase === 'paused'));
  });
}

test('a manifest connection failure retries automatically before downloading the edition', async () => {
  const env = environment({ '/': 'Index' });
  const fetch = env.worker.fetch;
  let attempts = 0;
  env.worker.fetch = async (request, options) => {
    if (new URL(address(request)).pathname === '/offline-manifest.json' && ++attempts === 1) {
      throw new TypeError('Connection reset');
    }
    return fetch(request, options);
  };
  const runtime = env.restart();
  await runtime.enable();
  await runtime.synchronize(true);
  assert.equal(attempts, 2);
  assert.deepEqual(env.retryDelays, [1000]);
  assert.equal((await runtime.status()).ready, true);
});

test('all assets finish before any page starts, even when one font is slow', async () => {
  // Deliberately list pages first: the worker must enforce the boundary itself.
  const env = environment({ '/': 'Index', '/a/': 'A', '/font.woff2': 'Font', '/app.js': 'JS', '/image.png': 'Image', '/search.json': 'Search' });
  const events = [];
  let releaseFont;
  let otherAssetsFinished;
  const fontWait = new Promise((resolve) => { releaseFont = resolve; });
  const otherAssets = new Promise((resolve) => { otherAssetsFinished = resolve; });
  const open = env.caches.open.bind(env.caches);
  env.caches.open = async (name) => {
    const cache = await open(name);
    return { ...cache, put: async (request, response) => {
      await cache.put(request, response);
      if (name.endsWith(':files')) {
        events.push(`saved:${new URL(address(request)).pathname}`);
        if (['/app.js', '/image.png', '/search.json'].every((url) => events.includes(`saved:${url}`))) otherAssetsFinished();
      }
    } };
  };
  const fetch = env.worker.fetch;
  env.worker.fetch = async (request, options) => {
    const url = new URL(address(request)).pathname;
    if (url === '/font.woff2') await fontWait;
    if (url.endsWith('/')) events.push(`page:${url}`);
    return fetch(request, options);
  };
  const runtime = env.restart();
  await runtime.enable();
  const download = runtime.synchronize(true);
  try {
    await waitForWorkerEvent(otherAssets, download, 'the other assets were saved');
    assert.ok(!events.some((event) => event.startsWith('page:')));
  } finally { releaseFont(); }
  await download;
  const firstPage = events.findIndex((event) => event.startsWith('page:'));
  for (const url of ['/font.woff2', '/app.js', '/image.png', '/search.json']) {
    assert.ok(events.indexOf(`saved:${url}`) < firstPage, url);
  }
  assert.equal((await runtime.status()).ready, true);
});

test('a failed asset prevents page downloads until automatic or manual recovery succeeds', async () => {
  const env = environment({ '/': 'Index', '/a/': 'A', '/font.woff2': 'Font', '/app.js': 'JS' });
  const runtime = env.restart();
  env.fail(['/font.woff2']);
  await runtime.enable();
  await runtime.synchronize(true);
  assert.equal((await runtime.status()).phase, 'paused');
  assert.equal(env.requests.filter((url) => url === '/font.woff2').length, 4);
  assert.ok(!env.requests.some((url) => url.endsWith('/')));
  env.fail([]);
  await runtime.synchronize(true);
  assert.equal((await runtime.status()).ready, true);
  assert.equal(env.requests.filter((url) => url === '/app.js').length, 1);
});

test('a request timeout retries with a fresh abort controller', async () => {
  const env = environment({ '/': 'Index' });
  const fetch = env.worker.fetch;
  const schedule = env.worker.setTimeout;
  env.worker.setTimeout = (callback, delay) => delay === 20000 ? setTimeout(callback, 0) : schedule(callback, delay);
  let attempts = 0;
  env.worker.fetch = async (request, options) => {
    if (new URL(address(request)).pathname === '/' && ++attempts === 1) {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
      });
    }
    return fetch(request, options);
  };
  const runtime = env.restart();
  await runtime.enable();
  await runtime.synchronize(true);
  assert.equal(attempts, 2);
  assert.deepEqual(env.retryDelays, [1000]);
  assert.equal((await runtime.status()).ready, true);
});

test('unchecking cancels a pending retry without making another request', async (t) => {
  const env = environment({ '/': 'Index' });
  const schedule = env.worker.setTimeout;
  let retryTimer;
  t.after(() => clearTimeout(retryTimer));
  let retryStarted;
  let retryCanceled = false;
  const waiting = new Promise((resolve) => { retryStarted = resolve; });
  env.worker.setTimeout = (callback, delay) => {
    if (delay !== 1000) return schedule(callback, delay);
    retryTimer = setTimeout(callback, 60000);
    retryStarted();
    return retryTimer;
  };
  env.worker.clearTimeout = (timer) => {
    if (timer === retryTimer) retryCanceled = true;
    clearTimeout(timer);
  };
  env.fail(['/']);
  const runtime = env.restart();
  await runtime.enable();
  const download = runtime.synchronize(true);
  await waitForWorkerEvent(waiting, download, 'a retry was scheduled');
  await runtime.disable();
  await download;
  assert.equal(retryCanceled, true);
  assert.equal(env.requests.filter((url) => url === '/').length, 1);
  assert.equal((await runtime.status()).enabled, false);
  assert.equal((await env.caches.keys()).length, 0);
  env.fail([]);
  await runtime.enable(true);
  await runtime.synchronize(true);
  assert.equal((await runtime.status()).ready, true);
});

test('updates keep the complete old edition until success, reuse unchanged files, and survive an offline restart', async () => {
  const env = environment({ '/': 'Old index', '/a/': 'Old A', '/font.woff2': 'Font' });
  let runtime = env.restart();
  await runtime.enable();
  await runtime.synchronize(true);
  env.deploy({ '/': 'New index', '/a/': 'New A', '/font.woff2': 'Font', '/b/': 'New B' }, '2');
  env.fail(['/a/']);
  env.requests.length = 0;
  await runtime.synchronize(true);
  assert.equal((await runtime.status()).ready, true);
  assert.equal((await runtime.status()).phase, 'paused');
  assert.equal(await (await runtime.respond(new Request('https://edition.test/'))).text(), 'Old index');
  assert.ok(!env.requests.includes('/font.woff2'));
  env.disconnect();
  runtime = env.restart();
  assert.equal(await (await runtime.respond(new Request('https://edition.test/a/'))).text(), 'Old A');
  env.reconnect();
  env.fail([]);
  await runtime.synchronize(true);
  assert.equal((await runtime.status()).version, hash('2'));
  env.disconnect();
  assert.equal(await (await runtime.respond(new Request('https://edition.test/'))).text(), 'New index');
  assert.equal(await (await runtime.respond(new Request('https://edition.test/b/'))).text(), 'New B');
});

test('a mixed deployment or error page cannot be marked offline-ready', async () => {
  const env = environment({ '/': 'Index', '/letter/': 'Correct edition' });
  const runtime = env.restart();
  env.override({ '/letter/': 'Wrong revision' });
  await runtime.enable();
  await runtime.synchronize(true);
  assert.equal((await runtime.status()).ready, false);
  assert.equal((await runtime.status()).error, 'changed');
  env.override({});
  await runtime.synchronize(true);
  assert.equal((await runtime.status()).ready, true);
});

test('storage failure is recoverable, disabling removes only this edition and cannot resume without opting in', async () => {
  const env = environment({ '/edition/': 'Index' }, { base: '/edition/' });
  const runtime = env.restart();
  await (await env.caches.open('unrelated-app')).put('https://edition.test/other', new Response('Keep'));
  env.caches.failPut = true;
  await runtime.enable();
  await runtime.synchronize(true);
  assert.equal((await runtime.status()).error, 'quota');
  assert.equal((await runtime.status()).ready, false);
  env.caches.failPut = false;
  await runtime.synchronize(true);
  assert.equal((await runtime.status()).ready, true);
  await runtime.disable();
  assert.equal(env.unregistered(), true);
  assert.deepEqual(await env.caches.keys(), ['unrelated-app']);
  assert.equal((await runtime.status()).enabled, false);
  await runtime.enable();
  assert.equal((await runtime.status()).enabled, false);
  assert.deepEqual(await env.caches.keys(), ['unrelated-app']);
  const restarted = env.restart();
  env.requests.length = 0;
  await restarted.synchronize(true);
  assert.equal(env.requests.length, 0);
});

test('simultaneous sync requests share a download and stopping cancels in-flight responses', async () => {
  const env = environment({ '/': 'Index', '/a/': 'A' });
  const runtime = env.restart();
  const fetch = env.worker.fetch;
  let started;
  const inFlight = new Promise((resolve) => { started = resolve; });
  env.worker.fetch = async (request, options) => {
    if (new URL(address(request)).pathname === '/a/') {
      started();
      await new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
    }
    return fetch(request, options);
  };
  await runtime.enable();
  const first = runtime.synchronize(true);
  try {
    assert.equal(first, runtime.synchronize(true));
    await waitForWorkerEvent(inFlight, first, 'the response started');
  } finally { await runtime.disable(); }
  await first;
  assert.equal((await runtime.status()).enabled, false);
  assert.equal((await env.caches.keys()).length, 0);
});

test('an explicit recheck restarts a reused worker and downloads the edition again', async () => {
  const env = environment({ '/': 'Index', '/a/': 'A' });
  const runtime = env.restart();
  function message(type, userInitiated = false) {
    return new Promise((resolve, reject) => {
      env.listeners.get('message')({
        source: { url: 'https://edition.test/' }, data: { type, userInitiated, force: true }, ports: [],
        waitUntil: (work) => work.then(resolve, reject),
      });
    });
  }
  await message('ENABLE', true);
  for (let cycle = 0; cycle < 2; cycle++) {
    assert.equal((await runtime.status()).ready, true);
    await message('DISABLE');
    assert.equal((await env.caches.keys()).length, 0);
    env.requests.length = 0;
    // An already-open tab's background request must not reverse an opt-out.
    await message('ENABLE');
    assert.equal((await runtime.status()).enabled, false);
    assert.equal(env.requests.length, 0);
    await message('ENABLE', true);
    assert.equal((await runtime.status()).ready, true);
    assert.deepEqual(env.requests.sort(), ['/', '/a/', '/offline-manifest.json']);
  }
});

test('rechecking during removal waits for cleanup before saving a fresh edition', async () => {
  const env = environment({ '/': 'Index' });
  const runtime = env.restart();
  await runtime.enable();
  await runtime.synchronize(true);
  const deleteCache = env.caches.delete.bind(env.caches);
  let deleting;
  let finishDeleting;
  const started = new Promise((resolve) => { deleting = resolve; });
  const release = new Promise((resolve) => { finishDeleting = resolve; });
  env.caches.delete = async (name) => {
    deleting();
    await release;
    return deleteCache(name);
  };
  const removal = runtime.disable();
  let enabled = false;
  let restart;
  try {
    await waitForWorkerEvent(started, removal, 'cache removal started');
    assert.equal(runtime.disable(), removal);
    restart = runtime.enable(true).then(() => { enabled = true; });
    await Promise.resolve();
    assert.equal(enabled, false);
  } finally { finishDeleting(); }
  await Promise.all([removal, restart]);
  await runtime.synchronize(true);
  assert.equal((await runtime.status()).ready, true);
  env.disconnect();
  assert.equal(await (await runtime.respond(new Request('https://edition.test/'))).text(), 'Index');
});
