import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { enrichGnd, gndId, summarizeGnd, summarizeDepiction, retryAfter } from '../scripts/gnd.mjs';
import { referenceLinks } from '../scripts/gnd-links.mjs';

const DAY = 86_400_000;
const personId = '118571656';
const placeId = '4057878-1';
const person = {
  gndIdentifier: personId, preferredName: 'Lenz, Jakob Michael Reinhold', type: ['Person'],
  dateOfBirth: ['1751-01-12'], placeOfBirth: [{ label: 'Cesvaine' }],
  dateOfDeath: ['1792-05-24'], professionOrOccupation: [{ label: 'Schriftsteller' }],
};
const place = {
  gndIdentifier: placeId, preferredName: 'Straßburg', type: ['PlaceOrGeographicName'],
  geographicAreaCode: [{ label: 'Frankreich' }],
  biographicalOrHistoricalInformation: ['Hauptstadt des Elsass'],
};
const definition = (id) => ({ name: id, ref: `https://d-nb.info/gnd/${id}` });
const response = (data, status = 200, headers = {}) => new Response(
  data == null ? null : JSON.stringify(data), { status, headers },
);

test('extracts supplied images with source, creator and license credits for people and places', () => {
  const depiction = {
    id: 'https://commons.wikimedia.org/wiki/Special:FilePath/Portrait.jpg',
    thumbnail: 'https://commons.wikimedia.org/wiki/Special:FilePath/Portrait.jpg?width=270',
    url: 'https://commons.wikimedia.org/wiki/File:Portrait.jpg',
    creatorName: ['Artist', 'Artist'], creditText: ['Museum'],
    license: [{ id: 'https://creativecommons.org/licenses/by-sa/4.0/', abbr: 'CC BY-SA 4.0' }],
  };
  const picture = summarizeDepiction({ depiction: [depiction] });
  assert.equal(picture.src, depiction.thumbnail);
  assert.equal(picture.source, depiction.url);
  assert.equal(picture.creator, 'Artist');
  assert.equal(picture.credit, 'Museum');
  assert.deepEqual(picture.licenses, [{ url: depiction.license[0].id, label: 'CC BY-SA 4.0' }]);
  assert.deepEqual(summarizeGnd({ ...person, depiction: [depiction] }, 'people').picture, picture);
  assert.deepEqual(summarizeGnd({ ...place, depiction: [depiction] }, 'places').picture, picture);
  assert.equal(summarizeDepiction({ depiction: [{ ...depiction, thumbnail: null }] }).src, depiction.id);
});

test('omits missing or unsafe images and incomplete credits, and tries the next supplied image', () => {
  assert.equal(summarizeDepiction(person), null);
  const valid = { thumbnail: 'https://images.example/picture.jpg', url: 'https://images.example/source',
    license: [{ id: 'https://creativecommons.org/publicdomain/mark/1.0/', name: 'Public Domain' }] };
  for (const invalid of [null, { ...valid, thumbnail: 'javascript:alert(1)' },
    { ...valid, thumbnail: 'https://user:password@images.example/picture.jpg' },
    { ...valid, url: 'data:text/html,test' }, { ...valid, license: [] }]) {
    assert.equal(summarizeDepiction({ depiction: [invalid] }), null);
    assert.equal(summarizeDepiction({ depiction: [invalid, valid] }).src, valid.thumbnail);
  }
});

async function fixture(t, catalog = { people: { 1: definition(personId) }, places: {} }) {
  const root = await mkdtemp(path.join(tmpdir(), 'lenz-gnd-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const output = path.join(root, 'generated');
  const cacheDirectory = path.join(root, 'cache');
  await mkdir(output);
  await mkdir(cacheDirectory);
  await writeFile(path.join(output, 'catalog.json'), JSON.stringify(catalog));
  const warnings = [];
  const options = {
    output, cacheDirectory, now: () => 100 * DAY,
    wait: async () => {}, logger: { info() {}, warn(message) { warnings.push(message); } },
  };
  return {
    options, warnings,
    run: (overrides = {}) => enrichGnd({ ...options, ...overrides }),
    cache: (value, id = personId) => writeFile(path.join(cacheDirectory, `${id}.json`), JSON.stringify(value)),
    read: (id = personId) => readFile(path.join(cacheDirectory, `${id}.json`), 'utf8').then(JSON.parse),
  };
}

test('export uses resolved image URLs and preserves them on unchanged-reference cache hits', async (t) => {
  const f = await fixture(t);
  const input = 'https://commons.wikimedia.org/wiki/Special:FilePath/Portrait.jpg?width=270';
  const direct = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/Portrait.jpg/330px-Portrait.jpg';
  await f.cache({ version: 1, status: 200, checkedAt: DAY, record: { ...person,
    depiction: [{ thumbnail: input, url: 'https://commons.wikimedia.org/wiki/File:Portrait.jpg',
      license: [{ id: 'https://creativecommons.org/publicdomain/mark/1.0/', abbr: 'PD' }] }],
  } });
  const first = await f.run({ cacheMode: 'reuse', fetchImpl: async (url, options) => {
    assert.equal(url, input);
    assert.equal(options.method, 'HEAD');
    return { ok: true, status: 200, url: direct, headers: new Headers({ 'content-type': 'image/jpeg' }) };
  } });
  assert.equal(first.information.people[1].picture.src, direct);
  assert.equal(first.stats.imageFailed, 0);
  const second = await f.run({ cacheMode: 'reuse', fetchImpl: () => assert.fail('no GND or image requests on cache hit') });
  assert.equal(second.information.people[1].picture.src, direct);
});

test('extracts exact GND URLs; ignores missing IDs and other hosts/paths', () => {
  for (const id of [personId, placeId, '12021363X', '115455998X']) {
    assert.equal(gndId(`http://d-nb.info/gnd/${id}`), id);
  }
  for (const ref of [null, '', 'https://example.com/118571656', 'https://d-nb.info.evil/gnd/118571656',
    'https://d-nb.info/gnd/../../foo', 'https://d-nb.info/gnd/unknown', `${personId}`]) {
    assert.equal(gndId(ref), null);
  }
});

test('formats life dates, retaining uncertainty and distinguishing one unknown date from two', () => {
  assert.equal(summarizeGnd(person, 'people').lifespan, '12.01.1751–24.05.1792');
  assert.equal(summarizeGnd({ ...person, dateOfBirth: ['ca. 1750'] }, 'people').lifespan, 'ca. 1750–24.05.1792');
  assert.equal(summarizeGnd({ ...person, dateOfBirth: [] }, 'people').lifespan, '?–24.05.1792');
  assert.equal(summarizeGnd({ ...person, dateOfDeath: [] }, 'people').lifespan, '12.01.1751–?');
  const undated = summarizeGnd({ ...person, dateOfBirth: [], dateOfDeath: [], professionOrOccupation: [] }, 'people');
  assert.equal(undated.lifespan, '');
  assert.equal(undated.occupations, '');
  assert.equal(undated.links[0].label, 'GND');
});

test('normalizes unlabeled details without replacing editorial names or mixing entity types', () => {
  assert.equal(summarizeGnd(person, 'people').occupations, 'Schriftsteller');
  assert.equal('preferredName' in summarizeGnd(person, 'people'), false);
  assert.equal(summarizeGnd(place, 'places').description, 'Hauptstadt des Elsass');
  assert.equal(summarizeGnd(place, 'places').geographicAreas, 'Frankreich');
  assert.equal(summarizeGnd(place, 'places').lifespan, '');
  assert.equal(summarizeGnd(place, 'people'), null);
  assert.equal(summarizeGnd(person, 'places'), null);
  assert.equal(summarizeGnd({ type: ['Person'] }, 'people'), null);
});

test('shows only the five chosen person providers, excludes Portraitindex, retains the NDB article and deduplicates Wikipedia and GND aliases', async () => {
  const wiki = 'https://de.wikipedia.org/wiki/Jakob_Michael_Reinhold_Lenz';
  const links = referenceLinks({ ...person,
    wikipedia: [{ id: wiki }],
    sameAs: [
      { id: wiki, collection: { abbr: 'dewiki' } },
      { id: 'http://de.wikipedia.org/wiki/Jakob_Michael_Reinhold_Lenz' },
      { id: 'https://www.deutsche-biographie.de/pnd118571656.html#adbcontent', collection: { abbr: 'ADB' } },
      { id: 'https://www.deutsche-biographie.de/pnd118571656.html#ndbcontent', collection: { abbr: 'NDB' } },
      { id: 'https://d-nb.info/gnd/157897842', collection: { abbr: 'DNB' } },
      { id: 'https://example.org/person/123', collection: { name: 'Another database', icon: 'https://remote.example/icon.png' } },
      { id: 'http://viaf.org/viaf/90638588', collection: { abbr: 'VIAF' } },
      { id: 'https://www.portraitindex.de/dokumente/pnd/118571656', collection: { abbr: 'Portraitindex' } },
      { id: 'https://kalliope-verbund.info/gnd/118571656', collection: { abbr: 'DE-611' } },
      { id: 'https://sws.geonames.org/2973783' },
      { id: 'https://en.wikipedia.org/wiki/Jakob_Michael_Reinhold_Lenz' },
      { id: 'javascript:alert(1)' }, { id: 'data:text/html,test' }, { id: 'https://user:secret@example.org/' }, null,
    ],
    homepage: [{ id: 'https://example.org/home' }],
  });
  assert.deepEqual(links.map(({ label }) => label), ['GND', 'Wikipedia', 'NDB', 'VIAF', 'Kalliope']);
  assert.equal(links[1].url, wiki);
  assert.equal(links[2].url, 'https://www.deutsche-biographie.de/pnd118571656.html#ndbcontent');
  for (const link of links) {
    assert.match(link.icon, /^[a-z0-9.-]+\.(svg|ico|png|gif)$/);
    await readFile(new URL(`../../assets/reference-icons/${link.icon}`, import.meta.url));
  }
});

test('does not invent missing provider links and falls back to another Wikipedia language', () => {
  assert.deepEqual(referenceLinks(person).map(({ label }) => label), ['GND']);
  const links = referenceLinks({ ...person, wikipedia: [{ id: 'https://en.wikipedia.org/wiki/Jakob_Michael_Reinhold_Lenz' }] });
  assert.equal(links.length, 2);
  assert.equal(links[1].label, 'Wikipedia');
  assert.equal(links[1].url, 'https://en.wikipedia.org/wiki/Jakob_Michael_Reinhold_Lenz');
});

test('place summaries offer only Wikipedia, GND and GeoNames, with local icons and no duplicates', async () => {
  const record = { ...place,
    wikipedia: [{ id: 'https://en.wikipedia.org/wiki/Strasbourg' }],
    sameAs: [
      { id: 'https://de.wikipedia.org/wiki/Stra%C3%9Fburg' },
      { id: 'https://sws.geonames.org/2973783', collection: { id: 'https://sws.geonames.org' } },
      { id: 'http://sws.geonames.org/2973783/' },
      { id: 'https://viaf.org/viaf/123', collection: { abbr: 'VIAF' } },
      { id: 'https://www.deutsche-biographie.de/pnd123.html#ndbcontent', collection: { abbr: 'NDB' } },
      { id: 'https://www.portraitindex.de/dokumente/pnd/123', collection: { abbr: 'Portraitindex' } },
      { id: 'https://kalliope-verbund.info/gnd/123', collection: { abbr: 'DE-611' } },
    ],
  };
  const { links } = summarizeGnd(record, 'places');
  assert.deepEqual(links.map(({ label }) => label), ['Wikipedia', 'GND', 'GeoNames']);
  assert.equal(links[0].url, 'https://de.wikipedia.org/wiki/Stra%C3%9Fburg');
  assert.equal(links[2].url, 'https://sws.geonames.org/2973783');
  assert.equal(links[2].icon, 'sws.geonames.org.ico');
  await readFile(new URL(`../../assets/reference-icons/${links[2].icon}`, import.meta.url));
  assert.deepEqual(referenceLinks(place, 'places').map(({ label }) => label), ['GND']);
  const fallback = referenceLinks({ ...place, wikipedia: record.wikipedia }, 'places');
  assert.deepEqual(fallback.map(({ label }) => label), ['Wikipedia', 'GND']);
  assert.equal(fallback[0].url, 'https://en.wikipedia.org/wiki/Strasbourg');
});

test('deduplicates IDs, fetches concurrently within the bound, and builds summaries by edition ID', async (t) => {
  const catalog = { people: {}, places: { 7: definition(placeId) } };
  const responses = new Map([[personId, person], [placeId, place]]);
  for (let i = 0; i < 8; i++) {
    const id = String(118571656 + i);
    catalog.people[i] = definition(id);
    responses.set(id, { ...person, gndIdentifier: id });
  }
  catalog.people.duplicate = definition(personId);
  catalog.people.missing = { name: 'Unknown' };
  const f = await fixture(t, catalog);
  let active = 0, peak = 0, calls = 0;
  const fetchImpl = async (url) => {
    active++; calls++; peak = Math.max(peak, active);
    await sleep(5);
    active--;
    return response(responses.get(url.match(/([^/]+)\.json$/)[1]));
  };
  const { information } = await f.run({ fetchImpl });
  assert.equal(calls, 9);
  assert.equal(peak, 4);
  assert.deepEqual(information.people.duplicate, information.people[0]);
  assert.equal(information.places[7].gndId, placeId);
  assert.equal(information.people.missing, undefined);
  const saved = JSON.parse(await readFile(path.join(f.options.output, 'gnd.json'), 'utf8'));
  assert.deepEqual(saved, information);
  const cached = await f.run({ fetchImpl: () => assert.fail('fresh cache must not use network') });
  assert.equal(cached.stats.cached, 9);
});

test('refreshes expired entries conditionally and accepts 304 without losing raw data', async (t) => {
  const f = await fixture(t);
  await f.cache({ version: 1, status: 200, checkedAt: 60 * DAY, record: person, etag: 'v1' });
  await f.run({ fetchImpl: async (_url, { headers }) => {
    assert.equal(headers['If-None-Match'], 'v1');
    return response(null, 304);
  } });
  const saved = await f.read();
  assert.equal(saved.checkedAt, 100 * DAY);
  assert.deepEqual(saved.record, person);
});

test('unchanged XML reuses old positive and negative responses while rebuilding summaries', async (t) => {
  const f = await fixture(t, { people: { renamed: definition(personId) }, places: { 7: definition(placeId) } });
  await f.cache({ version: 1, status: 200, checkedAt: DAY, record: person });
  await f.cache({ version: 1, status: 404, checkedAt: DAY }, placeId);
  const result = await f.run({ cacheMode: 'reuse', fetchImpl: () => assert.fail('unchanged XML must reuse saved responses') });
  assert.equal(result.stats.cached, 2);
  assert.equal(result.stats.missing, 1);
  assert.equal(result.information.people.renamed.gndId, personId);
});

test('changed XML refreshes even fresh positive and negative responses conditionally', async (t) => {
  const f = await fixture(t, { people: { 1: definition(personId) }, places: { 7: definition(placeId) } });
  await f.cache({ version: 1, status: 200, checkedAt: 99 * DAY, record: person, etag: 'v1' });
  await f.cache({ version: 1, status: 404, checkedAt: 99 * DAY }, placeId);
  const result = await f.run({ cacheMode: 'refresh', fetchImpl: async (url, { headers }) => {
    if (url.endsWith(`${personId}.json`)) {
      assert.equal(headers['If-None-Match'], 'v1');
      return response(null, 304);
    }
    return response(place);
  } });
  assert.equal(result.stats.fetched, 2);
  assert.equal(result.stats.cached, 0);
  assert.equal(result.information.places[7].gndId, placeId);
  assert.equal((await f.read()).checkedAt, 100 * DAY);
});

test('reuse mode fetches missing and corrupt responses and refresh mode keeps fallback data', async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const fetchImpl = async () => { calls++; return response(person); };
  await f.run({ cacheMode: 'reuse', fetchImpl });
  await writeFile(path.join(f.options.cacheDirectory, `${personId}.json`), '{broken');
  await f.run({ cacheMode: 'reuse', fetchImpl });
  assert.equal(calls, 2);
  const result = await f.run({ cacheMode: 'refresh', fetchImpl: async () => response(null, 503) });
  assert.equal(result.stats.stale, 1);
  assert.equal(result.information.people[1].gndId, personId);
});

test('retries transient errors with backoff, then retains stale information on exhaustion', async (t) => {
  const f = await fixture(t);
  await f.cache({ version: 1, status: 200, checkedAt: 60 * DAY, record: person });
  let calls = 0;
  const delays = [];
  const result = await f.run({
    fetchImpl: async () => { calls++; return response(null, 503); },
    wait: async (ms) => { delays.push(ms); },
  });
  assert.equal(calls, 3);
  assert.deepEqual(delays, [1000, 2000]);
  assert.equal(result.stats.stale, 1);
  assert.equal(result.information.people[1].gndId, personId);
  assert.equal((await f.read()).checkedAt, 60 * DAY);
  assert.match(f.warnings[0], /using saved data/);
});

test('honors Retry-After before retrying a rate-limited response', async (t) => {
  const f = await fixture(t);
  let calls = 0, time = 100 * DAY;
  const delays = [];
  await f.run({
    now: () => time,
    wait: async (ms) => { delays.push(ms); time += ms; },
    fetchImpl: async () => ++calls === 1 ? response(null, 429, { 'Retry-After': '5' }) : response(person),
  });
  assert.equal(calls, 2);
  assert.deepEqual(delays, [1000, 4000]);
  assert.equal(retryAfter('Thu, 01 Oct 2026 12:00:05 GMT', Date.parse('2026-10-01T12:00:00Z')), 5000);
});

test('negative caching prevents repeated 404s and expires after seven days', async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const fetchImpl = async () => { calls++; return response(null, 404); };
  assert.equal((await f.run({ fetchImpl })).stats.missing, 1);
  await f.run({ fetchImpl });
  assert.equal(calls, 1);
  await f.run({ fetchImpl, now: () => 108 * DAY });
  assert.equal(calls, 2);
});

test('permanent errors do not retry and a cold failed build emits empty information', async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const result = await f.run({ fetchImpl: async () => { calls++; return response(null, 403); } });
  assert.equal(calls, 1);
  assert.equal(result.stats.failed, 1);
  assert.deepEqual(result.information, { people: {}, places: {} });
});

test('invalid API data cannot overwrite valid cache; corrupt disk entries are refetched', async (t) => {
  const f = await fixture(t);
  await f.cache({ version: 1, status: 200, checkedAt: 60 * DAY, record: person });
  await f.run({ fetchImpl: async () => response(place) });
  assert.deepEqual((await f.read()).record, person);
  await writeFile(path.join(f.options.cacheDirectory, `${personId}.json`), '{broken');
  await f.run({ fetchImpl: async () => response(person) });
  assert.equal((await f.read()).checkedAt, 100 * DAY);
});

test('accepts an explicitly deprecated ID but omits incompatible entity types', async (t) => {
  const f = await fixture(t);
  const moved = { ...place, deprecatedUri: [`https://d-nb.info/gnd/${personId}`] };
  const result = await f.run({ fetchImpl: async () => response(moved) });
  assert.deepEqual(result.information.people, {});
  assert.match(f.warnings[0], /unexpected entity type/);
  assert.deepEqual((await f.read()).record, moved);
});

test('network budget ends a stalled fetch gracefully; explicit cancellation stops the export', async (t) => {
  const f = await fixture(t);
  const fetchImpl = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
  // Keep the test process alive while AbortSignal.timeout's unref'd timer is pending.
  const [result] = await Promise.all([f.run({ fetchImpl, networkTimeout: 20 }), sleep(40)]);
  assert.equal(result.stats.failed, 1);
  const controller = new AbortController();
  const pending = f.run({ fetchImpl, signal: controller.signal });
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(pending, { name: 'AbortError' });
});
