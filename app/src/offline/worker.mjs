// This self-contained function is emitted as a classic service worker by the
// build integration. Keeping its dependencies on `worker` also lets tests run
// the real download/recovery logic with an interrupted network and cache.
export function createOfflineWorker(worker) {
  const scope = new URL(worker.registration.scope);
  const prefix = `lenz-offline-v1:${scope.pathname}:`;
  const manifestURL = new URL('offline-manifest.json', scope).href;
  const stateURL = new URL('__offline_state__', scope).href;
  const emptyState = () => ({ enabled: false, active: null, previous: null, pending: null, checkedAt: 0, updatedAt: 0, error: null });
  let statePromise;
  let job = null;
  let abort = null;
  let stopping = false;
  let removal = null;
  let phase = 'idle';
  let progress = { done: 0, total: 0, bytes: 0, totalBytes: 0 };
  let lastBroadcast = 0;

  async function state() {
    if (!statePromise) statePromise = (async () => {
      const cache = await worker.caches.open(`${prefix}state`);
      const response = await cache.match(stateURL);
      return response ? response.json() : emptyState();
    })();
    return statePromise;
  }

  async function save(next) {
    const cache = await worker.caches.open(`${prefix}state`);
    await cache.put(stateURL, new Response(JSON.stringify(next), { headers: { 'Content-Type': 'application/json' } }));
    statePromise = Promise.resolve(next);
    return next;
  }

  function key(entry) {
    const url = new URL(entry.url, scope);
    url.searchParams.set('__offline_revision', entry.hash);
    return url.href;
  }

  async function storedKeys() {
    const cache = await worker.caches.open(`${prefix}files`);
    return new Set((await cache.keys()).map((request) => request.url));
  }

  function count(manifest, keys) {
    const entries = manifest?.entries || [];
    const saved = entries.filter((entry) => keys.has(key(entry)));
    return {
      done: saved.length, total: entries.length,
      bytes: saved.reduce((sum, entry) => sum + entry.bytes, 0),
      totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    };
  }

  async function status() {
    const saved = await state();
    let ready = Boolean(saved.active);
    if (!job) {
      const keys = saved.enabled ? await storedKeys() : new Set();
      progress = count(saved.pending || saved.active, keys);
      ready = Boolean(saved.active && saved.active.entries.every((entry) => keys.has(key(entry))));
    }
    const idlePhase = saved.error === 'quota' ? 'error'
      : saved.pending || (saved.enabled && !ready) ? 'paused' : 'ready';
    return {
      enabled: saved.enabled,
      phase: !saved.enabled ? 'off' : job ? phase : idlePhase,
      ...progress, ready,
      version: saved.active?.version || null,
      updatedAt: saved.updatedAt,
      error: saved.error,
    };
  }

  async function broadcast(force = false) {
    if (!force && Date.now() - lastBroadcast < 150) return;
    lastBroadcast = Date.now();
    const message = { type: 'lenz:offline-status', scope: scope.href, status: await status() };
    const clients = await worker.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if (client.url.startsWith(scope.href)) client.postMessage(message);
    }
  }

  function retryDelay(milliseconds, signal) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(signal.reason); return; }
      const cancel = () => {
        worker.clearTimeout(timer);
        signal.removeEventListener('abort', cancel);
        reject(signal.reason);
      };
      const timer = worker.setTimeout(() => {
        signal.removeEventListener('abort', cancel);
        resolve();
      }, milliseconds);
      signal.addEventListener('abort', cancel, { once: true });
    });
  }

  async function download(url, signal) {
    // Retry the failed request, including a reset while reading its body. Keep
    // the completed files and stop promptly if the user turns offline use off.
    for (let attempt = 0; ; attempt++) {
      try { return await requestDownload(url, signal); }
      catch (error) {
        if (signal.aborted || stopping || attempt === 3) throw error;
        await retryDelay(1000 * 2 ** attempt, signal);
      }
    }
  }

  async function requestDownload(url, signal) {
    const requestAbort = new AbortController();
    const cancel = () => requestAbort.abort();
    if (signal.aborted) cancel();
    signal.addEventListener('abort', cancel, { once: true });
    const timer = worker.setTimeout(cancel, 20000);
    try {
      const response = await worker.fetch(url, {
        cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: requestAbort.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.arrayBuffer();
      return { response, body };
    } finally {
      worker.clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
    }
  }

  function validateManifest(manifest) {
    if (manifest.schema !== 1 || !/^[a-f0-9]{64}$/.test(manifest.version)
      || !Array.isArray(manifest.entries) || !manifest.entries.length) throw new Error('Invalid offline manifest');
    const seen = new Set();
    for (const entry of manifest.entries) {
      const url = new URL(entry.url, scope);
      if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)
        || url.search || url.hash || !entry.url.startsWith(scope.pathname)
        || !/^[a-f0-9]{64}$/.test(entry.hash) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0
        || typeof entry.page !== 'boolean' || seen.has(url.href)
        || [manifestURL, new URL('sw.js', scope).href, stateURL].includes(url.href)) {
        throw new Error('Invalid offline entry');
      }
      seen.add(url.href);
    }
    return manifest;
  }

  async function run(force, signal) {
    let saved = await state();
    if (!saved.enabled || stopping) return;
    const keys = await storedKeys();
    progress = count(saved.pending || saved.active, keys);
    phase = 'checking';
    await broadcast(true);
    const complete = saved.active?.entries.every((entry) => keys.has(key(entry)));
    if (!force && complete && !saved.pending && Date.now() - saved.checkedAt < 60000) {
      phase = 'ready';
      return;
    }

    let manifest;
    try {
      const { body } = await download(manifestURL, signal);
      manifest = validateManifest(JSON.parse(new TextDecoder().decode(body)));
    } catch (error) {
      if (signal.aborted || stopping) return;
      // Finish a previously verified download even if the manifest endpoint is
      // temporarily unavailable. Its individual files still require hash checks.
      if (saved.pending) manifest = saved.pending;
      else if (complete) { phase = 'ready'; return; }
      else throw error;
    }
    if (signal.aborted || stopping) return;
    if (complete && saved.active.version === manifest.version) {
      await save({ ...saved, pending: null, checkedAt: Date.now(), error: null });
      phase = 'ready';
      return;
    }

    saved = await save({ ...saved, pending: manifest, error: null });
    progress = count(manifest, keys);
    phase = 'downloading';
    await broadcast(true);
    const cache = await worker.caches.open(`${prefix}files`);
    const missing = manifest.entries.filter((entry) => !keys.has(key(entry)));
    // Sorting alone isn't enough: a fast request could start HTML while a slow
    // font or image is still downloading. Finish and verify every asset first.
    for (const batch of [missing.filter((entry) => !entry.page), missing.filter((entry) => entry.page)]) {
      let cursor = 0;
      let failure;
      // Bound network and memory use. A completed cache.put is the durable
      // checkpoint; no page-owned queue or long-lived worker is required.
      await Promise.all(Array.from({ length: Math.min(4, batch.length) }, async () => {
        while (!failure && !signal.aborted && !stopping && cursor < batch.length) {
          const entry = batch[cursor++];
          try {
            const { response, body } = await download(new URL(entry.url, scope).href, signal);
            const digest = await worker.crypto.subtle.digest('SHA-256', body);
            const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
            if (hash !== entry.hash || body.byteLength !== entry.bytes) {
              const error = new Error('Deployment changed during download');
              error.name = 'EditionChangedError';
              throw error;
            }
            if (signal.aborted || stopping) return;
            // fetch() has decoded transfer compression; don't persist those
            // transfer headers with the decoded response body.
            const headers = new Headers(response.headers);
            headers.delete('content-encoding');
            headers.delete('content-length');
            await cache.put(key(entry), new Response(body, { status: 200, headers }));
            progress.done++;
            progress.bytes += entry.bytes;
            await broadcast();
          } catch (error) { failure ||= error; }
        }
      }));
      if (signal.aborted || stopping) return;
      if (failure) throw failure;
    }

    // Publish only a complete version. The previous generation also retains
    // hashed assets needed by pages that were already open during the update.
    const next = await save({
      ...saved, active: manifest,
      previous: saved.active?.version !== manifest.version ? saved.active : saved.previous,
      pending: null, checkedAt: Date.now(), updatedAt: Date.now(), error: null,
    });
    phase = 'ready';
    await broadcast(true);
    const keep = new Set([next.active, next.previous].flatMap((item) => item?.entries.map(key) || []));
    for (const request of await cache.keys()) {
      if (signal.aborted || stopping) return;
      if (!keep.has(request.url)) await cache.delete(request);
    }
  }

  function synchronize(force = false) {
    if (job) return job;
    if (stopping) return Promise.resolve();
    abort = new AbortController();
    job = run(force, abort.signal).catch(async (error) => {
      if (stopping) return;
      const saved = await state();
      const code = error.name === 'QuotaExceededError' ? 'quota'
        : error.name === 'EditionChangedError' ? 'changed' : 'network';
      // If storage is full even metadata may fail; report the failure without
      // discarding the last complete edition or already downloaded files.
      try { await save({ ...saved, error: code }); }
      catch { statePromise = Promise.resolve({ ...saved, error: code }); }
      phase = code === 'quota' ? 'error' : 'paused';
    }).finally(async () => {
      job = null;
      abort = null;
      if (!stopping) await broadcast(true);
    });
    return job;
  }

  async function enable(userInitiated = false) {
    // Re-registering while a page is still controlled can reuse this worker.
    // Only a fresh checkbox action may revive it; stale background checks must
    // not undo an opt-out. Finish deleting the old cache before starting again.
    if (stopping) {
      if (!userInitiated) return;
      await removal;
      stopping = false;
    }
    const saved = await state();
    if (stopping) return;
    if (!saved.enabled) await save({ ...saved, enabled: true });
  }

  function disable() {
    if (removal) return removal;
    stopping = true;
    abort?.abort();
    removal = (async () => {
      await job;
      try { await save(emptyState()); }
      catch { statePromise = Promise.resolve(emptyState()); }
      for (const name of await worker.caches.keys()) {
        if (name.startsWith(prefix)) await worker.caches.delete(name);
      }
      await worker.registration.unregister();
      phase = 'off';
      await broadcast(true);
    })().finally(() => { removal = null; });
    return removal;
  }

  async function respond(request) {
    const saved = await state();
    if (!saved.enabled || stopping) return worker.fetch(request);
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/index\.html$/, '/');
    const cache = await worker.caches.open(`${prefix}files`);
    for (const manifest of [saved.active, saved.active ? null : saved.pending, saved.previous]) {
      const entry = manifest?.entries.find((item) => item.url === pathname && (item.page || !url.search));
      // Old hashed scripts/fonts can support an open page; deleted pages must
      // not reappear from a superseded edition.
      if (!entry || (manifest === saved.previous && entry.page)) continue;
      const response = await cache.match(key(entry));
      if (response) return response;
    }
    try { return await worker.fetch(request); }
    catch (error) {
      if (request.mode !== 'navigate') throw error;
      return new Response('<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Offline</title><p>Diese Seite ist noch nicht offline verfügbar.</p><p><a href="' + scope.pathname + '">Zum Briefverzeichnis</a></p></html>', {
        status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  }

  worker.addEventListener('activate', (event) => event.waitUntil(worker.clients.claim()));
  worker.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || url.origin !== scope.origin
      || !url.pathname.startsWith(scope.pathname) || url.href === manifestURL
      || url.pathname === new URL('sw.js', scope).pathname) return;
    event.respondWith(respond(event.request));
  });
  worker.addEventListener('message', (event) => {
    if (!['STATUS', 'ENABLE', 'SYNC', 'DISABLE'].includes(event.data?.type)) return;
    const source = event.source && new URL(event.source.url);
    if (!source || source.origin !== scope.origin || !source.pathname.startsWith(scope.pathname)) return;
    event.waitUntil((async () => {
      try {
        if (event.data.type === 'DISABLE') await disable();
        if (event.data.type === 'ENABLE') await enable(event.data.userInitiated === true);
        const work = ['ENABLE', 'SYNC'].includes(event.data.type) ? synchronize(Boolean(event.data.force)) : null;
        event.ports[0]?.postMessage({ status: await status() });
        await work;
      } catch (error) {
        event.ports[0]?.postMessage({ error: error.name || 'Error' });
      }
    })());
  });
  return { enable, disable, synchronize, status, respond };
}
