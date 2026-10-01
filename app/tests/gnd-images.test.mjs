import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveGndImages } from '../scripts/gnd-images.mjs';

const input = 'https://commons.wikimedia.org/wiki/Special:FilePath/Portrait.jpg?width=270';
const direct = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Portrait.jpg/330px-Portrait.jpg';
const DAY = 86_400_000;
const info = () => ({ people: { 1: { picture: { src: input, source: 'https://commons.wikimedia.org/wiki/File:Portrait.jpg', creator: 'Artist', licenses: ['PD'] } } }, places: {} });
const head = (url = direct, status = 200, type = 'image/jpeg') => ({
  url, status, ok: status === 200, headers: new Headers({ 'content-type': type }),
});

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'lenz-images-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cacheFile = path.join(root, 'resolved-images.json');
  const warnings = [];
  return {
    run: (information, options = {}) => resolveGndImages(information, {
      cacheFile, now: () => 100 * DAY, wait: async () => {}, requestInterval: 0,
      logger: { warn: (message) => warnings.push(message) }, ...options,
    }),
    save: (entry) => writeFile(cacheFile, JSON.stringify({ version: 1, images: { [input]: entry } })),
    read: () => readFile(cacheFile, 'utf8').then(JSON.parse), warnings,
  };
}

test('resolves unique Commons thumbnails using HEAD, removes tracking and preserves credits', async (t) => {
  const f = await fixture(t);
  const information = info();
  information.places[2] = structuredClone(information.people[1]);
  let calls = 0;
  const result = await f.run(information, { fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, input);
    assert.equal(options.method, 'HEAD');
    assert.equal(options.redirect, 'follow');
    return head(direct + '?utm_source=commons&utm_campaign=index');
  } });
  assert.equal(calls, 1);
  assert.equal(result.failed, 0);
  assert.equal(information.people[1].picture.src, direct);
  assert.equal(information.places[2].picture.src, direct);
  assert.equal(information.people[1].picture.creator, 'Artist');
  assert.deepEqual(information.people[1].picture.licenses, ['PD']);
  assert.equal((await f.read()).images[input].src, direct);
});

test('reuse skips network regardless of cache age, while refresh resolves again', async (t) => {
  const f = await fixture(t);
  await f.save({ src: direct, checkedAt: DAY });
  const information = info();
  await f.run(information, { cacheMode: 'reuse', fetchImpl: () => assert.fail('must reuse saved URL') });
  assert.equal(information.people[1].picture.src, direct);
  let calls = 0;
  await f.run(info(), { cacheMode: 'refresh', fetchImpl: async () => { calls++; return head(); } });
  assert.equal(calls, 1);
});

test('404 images are omitted and negative cache is reused; expired local entries retry', async (t) => {
  const f = await fixture(t);
  const missing = info();
  await f.run(missing, { fetchImpl: async () => head(input, 404) });
  assert.equal(missing.people[1].picture, null);
  const cached = info();
  await f.run(cached, { fetchImpl: () => assert.fail('fresh missing image must be cached') });
  assert.equal(cached.people[1].picture, null);
  const restored = info();
  await f.run(restored, { now: () => 108 * DAY, fetchImpl: async () => head() });
  assert.equal(restored.people[1].picture.src, direct);
});

test('temporary failures retain a saved direct URL without marking the refresh complete', async (t) => {
  const f = await fixture(t);
  await f.save({ src: direct, checkedAt: DAY });
  const information = info();
  const result = await f.run(information, { cacheMode: 'refresh', fetchImpl: async () => head(input, 503) });
  assert.equal(result.failed, 1);
  assert.equal(information.people[1].picture.src, direct);
  assert.equal((await f.read()).images[input].checkedAt, DAY);
});

test('rejects non-image and non-Wikimedia redirect results without poisoning the cache', async (t) => {
  const f = await fixture(t);
  for (const response of [head('https://example.org/image.jpg'), head(direct, 200, 'text/html')]) {
    const information = info();
    assert.equal((await f.run(information, { fetchImpl: async () => response })).failed, 1);
    assert.equal(information.people[1].picture.src, input);
    assert.deepEqual((await f.read()).images, {});
  }
});

test('leaves already direct and non-Commons providers alone', async (t) => {
  const f = await fixture(t);
  const information = info();
  information.people[1].picture.src = direct;
  information.places[2] = { picture: { src: 'https://example.org/picture.jpg' } };
  await f.run(information, { fetchImpl: () => assert.fail('no redirect resolution needed') });
  assert.equal(information.people[1].picture.src, direct);
  assert.equal(information.places[2].picture.src, 'https://example.org/picture.jpg');
});

test('rate-limited HEAD requests honor Retry-After before retrying', async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const delays = [];
  const result = await f.run(info(), {
    wait: async (ms) => { delays.push(ms); },
    fetchImpl: async () => {
      if (++calls > 1) return head();
      return { ...head(input, 429), headers: new Headers({ 'retry-after': '5' }) };
    },
  });
  assert.equal(result.failed, 0);
  assert.equal(calls, 2);
  assert.ok(delays[1] >= 4900 && delays[1] <= 5000);
});
