import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { referenceLinks } from './gnd-links.mjs';
import { resolveGndImages } from './gnd-images.mjs';
import { gndCoordinates } from '../src/lib/correspondence-map.mjs';

const DAY = 86_400_000;
const VERSION = 1;
const GND_ID = /^(?:\d{8,10}[\dX]|\d{1,8}-[\dX])$/;

export function gndId(reference) {
  if (typeof reference !== 'string') return null;
  const match = reference.match(/^https?:\/\/d-nb\.info\/gnd\/([^/?#]+)\/?$/);
  return match && GND_ID.test(match[1]) ? match[1] : null;
}

const strings = (values) => [...new Set((Array.isArray(values) ? values : [])
  .filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))];
const labels = (values) => strings(Array.isArray(values) ? values.map((value) => value?.label) : []);
const date = (value) => value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3.$2.$1');

function webUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function summarizeDepiction(record) {
  for (const depiction of Array.isArray(record?.depiction) ? record.depiction : []) {
    const src = webUrl(depiction?.thumbnail) || webUrl(depiction?.id);
    const source = webUrl(depiction?.url);
    const licenses = (Array.isArray(depiction?.license) ? depiction.license : []).flatMap((license) => {
      const url = webUrl(license?.id);
      const label = license?.abbr || license?.name;
      return url && typeof label === 'string' && label.trim() ? [{ url, label: label.trim() }] : [];
    });
    if (!src || !source || !licenses.length) continue;
    return {
      src, source, licenses,
      creator: strings(depiction.creatorName).join(', '),
      credit: strings(depiction.creditText).join(' · '),
    };
  }
  return null;
}

function isRecord(record, id) {
  return record && typeof record.preferredName === 'string' &&
    GND_ID.test(record.gndIdentifier) && Array.isArray(record.type) &&
    (record.gndIdentifier === id || (Array.isArray(record.deprecatedUri) &&
      record.deprecatedUri.some((uri) => gndId(uri) === id)));
}

export function summarizeGnd(record, kind, reference) {
  // A linked ID can be wrong in the source. Never label a corporate body as a person/place.
  if (!record?.type?.includes(kind === 'people' ? 'Person' : 'PlaceOrGeographicName')) return null;
  if (!GND_ID.test(record.gndIdentifier)) return null;
  const birth = strings(record.dateOfBirth).map(date).join(' / ');
  const death = strings(record.dateOfDeath).map(date).join(' / ');
  const description = kind === 'places' ? strings(record.biographicalOrHistoricalInformation)[0] || '' : '';
  return {
    gndId: record.gndIdentifier,
    ...(kind === 'places' ? { coordinates: gndCoordinates(record) } : {}),
    lifespan: kind === 'people' && (birth || death) ? `${birth || '?'}–${death || '?'}` : '',
    occupations: kind === 'people' ? labels(record.professionOrOccupation).join(', ') : '',
    geographicAreas: kind === 'places' ? labels(record.geographicAreaCode).join(', ') : '',
    description: description.length > 500 ? `${description.slice(0, 500).replace(/\s+\S*$/, '')} …` : description,
    links: referenceLinks(record, kind, reference),
    picture: kind === 'people' ? summarizeDepiction(record) : null,
  };
}

async function readCache(file, id) {
  try {
    const entry = JSON.parse(await readFile(file, 'utf8'));
    if (entry?.version === VERSION && Number.isFinite(entry.checkedAt) &&
        (entry.status === 404 || (entry.status === 200 && isRecord(entry.record, id)))) return entry;
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }
  return null;
}

async function writeJson(file, value) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value)}\n`);
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

export function retryAfter(value, now) {
  if (!value) return 0;
  const seconds = Number(value);
  return Math.max(0, Number.isFinite(seconds) ? seconds * 1000 : (Date.parse(value) || now) - now);
}

/** Fetch only exact IDs from the edition; keep the raw responses outside generated/. */
export async function enrichGnd({
  output,
  cacheDirectory = path.join(output, '../.cache/gnd'),
  cacheMode = 'ttl',
  signal,
  fetchImpl = fetch,
  now = Date.now,
  wait = (ms, signal) => sleep(ms, undefined, { signal }),
  logger = console,
  concurrency = 4,
  requestTimeout = 10_000,
  networkTimeout = 90_000,
} = {}) {
  if (!['ttl', 'reuse', 'refresh'].includes(cacheMode)) throw new Error(`Unknown GND cache mode: ${cacheMode}`);
  const catalog = JSON.parse(await readFile(path.join(output, 'catalog.json'), 'utf8'));
  const ids = [...new Set(['people', 'places'].flatMap((kind) =>
    Object.values(catalog[kind]).map((definition) => gndId(definition.ref)).filter(Boolean)))].sort();
  await mkdir(cacheDirectory, { recursive: true });
  const networkSignal = AbortSignal.any([
    ...(signal ? [signal] : []), AbortSignal.timeout(networkTimeout),
  ]);
  const records = new Map();
  const stats = { cached: 0, fetched: 0, missing: 0, stale: 0, failed: 0 };
  let nextRequestAt = 0;

  async function request(id, cached) {
    for (let attempt = 0; attempt < 3; attempt++) {
      networkSignal.throwIfAborted();
      while (nextRequestAt > now()) await wait(nextRequestAt - now(), networkSignal);
      const headers = { Accept: 'application/json', 'User-Agent': 'Lenz-Briefe/1.0 (https://lenz-briefe.de)' };
      if (cached?.etag) headers['If-None-Match'] = cached.etag;
      if (cached?.lastModified) headers['If-Modified-Since'] = cached.lastModified;
      let retryable = true;
      try {
        const response = await fetchImpl(`https://lobid.org/gnd/${id}.json`, {
          headers, signal: AbortSignal.any([networkSignal, AbortSignal.timeout(requestTimeout)]),
        });
        if (response.status === 304 && cached?.status === 200) {
          return { ...cached, checkedAt: now() };
        }
        if (response.status === 404) {
          await response.body?.cancel();
          return { version: VERSION, status: 404, checkedAt: now() };
        }
        if (response.ok) {
          const record = await response.json();
          if (!isRecord(record, id)) throw new Error('invalid GND response or mismatched identifier');
          return {
            version: VERSION, status: 200, checkedAt: now(), record,
            etag: response.headers.get('etag'), lastModified: response.headers.get('last-modified'),
          };
        }
        retryable = [408, 429].includes(response.status) || response.status >= 500;
        nextRequestAt = Math.max(nextRequestAt, now() + retryAfter(response.headers.get('retry-after'), now()));
        await response.body?.cancel();
        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        if (!retryable || attempt === 2 || networkSignal.aborted) throw error;
        await wait(1000 * 2 ** attempt, networkSignal);
      }
    }
  }

  let cursor = 0;
  async function worker() {
    while (cursor < ids.length) {
      signal?.throwIfAborted();
      const id = ids[cursor++];
      const file = path.join(cacheDirectory, `${id}.json`);
      let entry = await readCache(file, id);
      const ttl = entry?.status === 404 ? 7 * DAY : 30 * DAY;
      if (entry && (cacheMode === 'reuse' ||
          (cacheMode === 'ttl' && now() - entry.checkedAt >= 0 && now() - entry.checkedAt < ttl))) {
        stats.cached++;
      } else {
        try {
          entry = await request(id, entry);
          await writeJson(file, entry);
          stats.fetched++;
        } catch (error) {
          signal?.throwIfAborted();
          if (entry?.status === 200) stats.stale++;
          else stats.failed++;
          logger.warn(`[GND] ${id}: ${error.message}; ${entry?.status === 200 ? 'using saved data' : 'no information available'}.`);
        }
      }
      if (entry?.status === 200) records.set(id, entry.record);
      else if (entry?.status === 404) stats.missing++;
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), ids.length) }, worker));
  signal?.throwIfAborted();
  const information = { people: {}, places: {} };
  for (const kind of ['people', 'places']) {
    for (const [id, definition] of Object.entries(catalog[kind])) {
      const record = records.get(gndId(definition.ref));
      const summary = summarizeGnd(record, kind, definition.ref);
      if (summary) information[kind][id] = summary;
      else if (record && !record.type.includes(kind === 'people' ? 'Person' : 'PlaceOrGeographicName')) {
        logger.warn(`[GND] ${definition.name}: ${definition.ref} has an unexpected entity type; omitted.`);
      }
    }
  }
  const images = await resolveGndImages(information, {
    cacheFile: path.join(cacheDirectory, 'resolved-images.json'), cacheMode,
    fetchImpl, now, signal, requestTimeout, logger,
  });
  stats.imageFailed = images.failed;
  await writeJson(path.join(output, 'gnd.json'), information);
  logger.info(`[GND] ${ids.length} IDs: ${stats.cached} cached, ${stats.fetched} fetched, ${stats.stale} stale, ${stats.missing} not found, ${stats.failed} unavailable.`);
  return { information, stats };
}
