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

const hash = (value) => createHash('sha256').update(value).digest('hex');
const address = (request) => typeof request === 'string' ? request : request.url;

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
  const messages = [];
  const listeners = new Map();
  let unregistered = false;
  const worker = {
    caches, crypto: webcrypto, setTimeout, clearTimeout,
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
    worker, requests, messages, caches, listeners,
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
      '/edition/_astro/font.woff2', '/edition/', '/edition/briefe/1/', '/edition/Gr%C3%BC%C3%9Fe.txt',
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

test('offline manifest excludes source notices, keeps the license page, and downloads intact from Astro preview', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'lenz-offline-preview-'));
  let server;
  try {
    const output = path.join(directory, 'dist');
    await mkdir(path.join(output, 'licenses/npm/@scope__name@1.0'), { recursive: true });
    await mkdir(path.join(output, 'edition/lizenzen'), { recursive: true });
    await mkdir(path.join(directory, 'src/pages'), { recursive: true });
    await writeFile(path.join(output, 'index.html'), '<h1>Edition</h1>');
    await writeFile(path.join(output, 'edition/lizenzen/index.html'), '<h1>Lizenzen</h1>');
    const notices = ['npm/@scope__name@1.0/LICENSE', 'npm/@scope__name@1.0/package-metadata.json'];
    for (const file of notices) await writeFile(path.join(output, 'licenses', file), 'Notice');
    await writeFile(path.join(output, 'Grüße.txt'), 'Grüße');
    const manifest = await buildOfflineEdition(output, '/edition/');
    assert.equal(manifest.entries.length, 3);
    assert.ok(manifest.entries.some((entry) => entry.url === '/edition/edition/lizenzen/' && entry.page));
    assert.ok(!manifest.entries.some((entry) => entry.url.startsWith('/edition/licenses/')));
    // Updating excluded files should not trigger an offline edition update.
    await writeFile(path.join(output, 'licenses', notices[0]), 'Revised notice');
    assert.equal((await buildOfflineEdition(output, '/edition/')).version, manifest.version);
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
  } finally {
    await server?.stop();
    await rm(directory, { recursive: true, force: true });
  }
});

test('interrupted downloads resume after worker/page restart without redownloading saved files', async () => {
  const env = environment({ '/': 'Index', '/a/': 'A', '/b/': 'B', '/c/': 'C', '/d/': 'D', '/e/': 'E' });
  let runtime = env.restart();
  env.fail(['/b/']);
  await runtime.enable();
  await runtime.synchronize(true);
  const before = await runtime.status();
  assert.equal(before.phase, 'paused');
  assert.ok(before.done > 0 && before.done < before.total);
  const saved = [...env.caches.stores.values()].flatMap((store) => [...store.keys()])
    .filter((url) => url.includes('__offline_revision')).map((url) => new URL(url).pathname);
  env.fail([]);
  runtime = env.restart();
  env.requests.length = 0;
  await runtime.synchronize(true);
  assert.equal((await runtime.status()).phase, 'ready');
  assert.ok(saved.every((url) => !env.requests.includes(url)));
  assert.ok(env.requests.includes('/b/'));
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
  assert.equal(first, runtime.synchronize(true));
  await inFlight;
  await runtime.disable();
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
  await started;
  assert.equal(runtime.disable(), removal);
  let enabled = false;
  const restart = runtime.enable(true).then(() => { enabled = true; });
  await Promise.resolve();
  assert.equal(enabled, false);
  finishDeleting();
  await Promise.all([removal, restart]);
  await runtime.synchronize(true);
  assert.equal((await runtime.status()).ready, true);
  env.disconnect();
  assert.equal(await (await runtime.respond(new Request('https://edition.test/'))).text(), 'Index');
});
