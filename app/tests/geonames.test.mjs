import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { enrichGeoNames, wikipediaFromGeoNames, coordinatesFromGeoNames } from '../scripts/geonames.mjs';
const rdf = '<gn:Feature rdf:about="https://sws.geonames.org/123/"><wgs84_pos:lat>51.31667</wgs84_pos:lat><wgs84_pos:long>9.5</wgs84_pos:long><gn:wikipediaArticle rdf:resource="http://en.wikipedia.org/wiki/Kassel"/></gn:Feature>';
const places = () => ({ a: { links: [{label:'Wikipedia', url:'https://de.wikipedia.org/wiki/Wrong'}, {label:'GeoNames',url:'https://sws.geonames.org/123'}] } });

test('only reads Wikipedia links from the matching feature and prefers German when supplied', () => {
  assert.equal(wikipediaFromGeoNames(rdf, '123'), 'https://en.wikipedia.org/wiki/Kassel');
  assert.throws(() => wikipediaFromGeoNames(rdf, '999'), /mismatched/);
  assert.equal(wikipediaFromGeoNames(rdf.replace('</gn:Feature>', '<gn:wikipediaArticle rdf:resource="https://de.wikipedia.org/wiki/Kassel"/></gn:Feature>'), '123'), 'https://de.wikipedia.org/wiki/Kassel');
  assert.equal(wikipediaFromGeoNames(rdf.replace('http://en.wikipedia.org/wiki/Kassel', 'javascript:alert(1)'), '123'), null);
});

test('replaces GND namesakes, caches records and retains saved links on outages', async t => {
  const cacheDirectory = await mkdtemp(path.join(tmpdir(), 'geonames-'));
  t.after(() => rm(cacheDirectory, {recursive:true, force:true}));
  let calls = 0;
  const options = {cacheDirectory, logger:{info(){},warn(){}}, fetchImpl:async () => {calls++; return new Response(rdf);} };
  const data = places();
  data.a.coordinates = {longitude:1, latitude:2};
  await enrichGeoNames(data, options);
  assert.equal(data.a.links[0].url, 'https://en.wikipedia.org/wiki/Kassel');
  assert.deepEqual(data.a.coordinates, {longitude:9.5, latitude:51.31667});
  assert.equal(data.a.coordinateSource, 'https://sws.geonames.org/123/about.rdf');
  await enrichGeoNames(places(), options);
  assert.equal(calls, 1);
  const stale = places();
  const stats = await enrichGeoNames(stale, {...options,cacheMode:'refresh',fetchImpl:async()=>{throw new Error('offline');}});
  assert.equal(stats.stale, 1);
  assert.equal(stale.a.links[0].url, 'https://en.wikipedia.org/wiki/Kassel');
});


test('GeoNames coordinates preserve longitude/latitude order and reject missing or invalid values', () => {
  assert.deepEqual(coordinatesFromGeoNames(rdf, '123'), {longitude:9.5, latitude:51.31667});
  assert.equal(coordinatesFromGeoNames(rdf.replace('51.31667', '91'), '123'), null);
  assert.equal(coordinatesFromGeoNames(rdf.replace('9.5', 'invalid'), '123'), null);
  assert.equal(coordinatesFromGeoNames(rdf.replace('<wgs84_pos:long>9.5</wgs84_pos:long>', ''), '123'), null);
  assert.throws(() => coordinatesFromGeoNames(rdf, '999'), /mismatched/);
});
