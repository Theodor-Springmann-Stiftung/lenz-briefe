import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const DAY = 86_400_000;
const imageHosts = new Set(['thumb.wikimedia.org', 'upload.wikimedia.org']);

function directImage(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !imageHosts.has(url.hostname) || url.username || url.password) return null;
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith('utm_')) url.searchParams.delete(key);
    }
    return url.href;
  } catch { return null; }
}

/** Resolve Commons redirects during export, before browser request filters see them. */
export async function resolveGndImages(information, {
  cacheFile, cacheMode = 'ttl', fetchImpl = fetch, now = Date.now,
  signal, requestTimeout = 10_000, networkTimeout = 240_000, requestInterval = 1500,
  wait = (ms, signal) => sleep(ms, undefined, { signal }), logger = console,
}) {
  let cached = {};
  try {
    const saved = JSON.parse(await readFile(cacheFile, 'utf8'));
    if (saved.version === 1 && saved.images && typeof saved.images === 'object') cached = saved.images;
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }
  const pictures = Object.values(information).flatMap((group) => Object.values(group))
    .map((summary) => summary.picture).filter(Boolean);
  const inputs = [...new Set(pictures.map((picture) => picture.src))].filter((src) => {
    const url = new URL(src);
    return url.protocol === 'https:' && url.hostname === 'commons.wikimedia.org'
      && url.pathname.startsWith('/wiki/Special:FilePath/');
  });
  const resolved = new Map();
  const budget = AbortSignal.any([
    ...(signal ? [signal] : []), AbortSignal.timeout(networkTimeout),
  ]);
  let cursor = 0, failed = 0, nextRequestAt = 0;
  async function request(src) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await wait(Math.max(0, nextRequestAt - Date.now()), budget);
      nextRequestAt = Date.now() + requestInterval;
      const response = await fetchImpl(src, {
        method: 'HEAD', redirect: 'follow',
        headers: { 'User-Agent': 'Lenz-Briefe/1.0 (https://lenz-briefe.de)' },
        signal: AbortSignal.any([budget, AbortSignal.timeout(requestTimeout)]),
      });
      await response.body?.cancel();
      if ((response.status !== 429 && response.status < 500) || attempt === 2) return response;
      const retry = response.headers.get('retry-after');
      const retryMs = retry === null ? 0 : /^\d+$/.test(retry)
        ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - Date.now()) || 0;
      nextRequestAt = Math.max(nextRequestAt, Date.now() + Math.max(retryMs, 1000 * 2 ** attempt));
    }
  }
  async function worker() {
    while (cursor < inputs.length) {
      signal?.throwIfAborted();
      const src = inputs[cursor++];
      const entry = cached[src];
      const valid = entry && Number.isFinite(entry.checkedAt)
        && (entry.src === null || directImage(entry.src));
      if (valid && (cacheMode === 'reuse' || (cacheMode === 'ttl'
          && now() >= entry.checkedAt && now() - entry.checkedAt < (entry.src === null ? 7 : 30) * DAY))) {
        resolved.set(src, entry.src === null ? null : directImage(entry.src));
        continue;
      }
      try {
        const response = await request(src);
        let target = null;
        if (response.ok) {
          target = directImage(response.url);
          if (!target || !response.headers.get('content-type')?.startsWith('image/')) {
            throw new Error('expected a direct Wikimedia image response');
          }
        } else if (![404, 410].includes(response.status)) {
          throw new Error(`HTTP ${response.status}`);
        }
        cached[src] = { src: target, checkedAt: now() };
        resolved.set(src, target);
      } catch (error) {
        signal?.throwIfAborted();
        failed++;
        if (valid) resolved.set(src, entry.src === null ? null : directImage(entry.src));
        logger.warn(`[GND image] ${src}: ${error.message}; ${valid ? 'using saved result' : 'keeping supplied URL'}.`);
      }
    }
  }
  await worker();
  signal?.throwIfAborted();
  for (const group of Object.values(information)) {
    for (const summary of Object.values(group)) {
      const src = summary.picture?.src;
      if (!resolved.has(src)) continue;
      const target = resolved.get(src);
      if (target) summary.picture.src = target;
      else summary.picture = null;
    }
  }
  if (inputs.length) {
    const temporary = `${cacheFile}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify({ version: 1, images: cached }) + '\n');
      await rename(temporary, cacheFile);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  return { failed };
}
