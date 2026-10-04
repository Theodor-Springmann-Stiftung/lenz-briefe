import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export function geonamesId(value) {
  return /^https?:\/\/(?:sws\.|www\.)?geonames\.org\/(\d+)(?:\/|$)/.exec(value || '')?.[1] || null;
}

function geoNamesFeature(rdf, id) {
  const feature = [...rdf.matchAll(/<gn:Feature\b[^>]*rdf:about=["']https?:\/\/sws\.geonames\.org\/(\d+)\/["'][^>]*>([\s\S]*?)<\/gn:Feature>/g)]
    .find(match => match[1] === id)?.[2];
  if (!feature) throw new Error('GeoNames feature identifier missing or mismatched');
  return feature;
}

export function coordinatesFromGeoNames(rdf, id) {
  const feature = geoNamesFeature(rdf, id);
  const coordinate = name => {
    const value = new RegExp(`<wgs84_pos:${name}\\b[^>]*>\\s*([^<]+)\\s*</wgs84_pos:${name}>`).exec(feature)?.[1]?.trim();
    return value ? Number(value) : NaN;
  };
  const latitude = coordinate('lat'), longitude = coordinate('long');
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { longitude, latitude } : null;
}

export function wikipediaFromGeoNames(rdf, id) {
  const feature = geoNamesFeature(rdf, id);
  const links = [...feature.matchAll(/<gn:wikipediaArticle\b[^>]*rdf:resource=["']([^"']+)["']/g)]
    .map(match => match[1].replaceAll('&amp;', '&'))
    .filter(url => /^https?:\/\/[a-z-]+\.wikipedia\.org\/wiki\/[^\s<>]+$/.test(url))
    .map(url => url.replace(/^http:/, 'https:'));
  return links.find(url => url.startsWith('https://de.wikipedia.org/')) || links[0] || null;
}

export async function enrichGeoNames(places, {
  cacheDirectory, cacheMode = 'ttl', fetchImpl = fetch, now = Date.now,
  signal, requestTimeout = 10000, logger = console,
} = {}) {
  await mkdir(cacheDirectory, { recursive: true });
  const stats = { fetched: 0, cached: 0, failed: 0, stale: 0 };
  const resolved = new Map();
  const networkSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(90000)]);
  for (const place of Object.values(places)) {
    const id = geonamesId(place.links.find(link => link.label === 'GeoNames')?.url);
    if (!id) continue;
    // Do not retain potentially unrelated GND Wikipedia matches if GeoNames
    // is authoritative for this place but temporarily unavailable.
    place.links = place.links.filter(link => link.label !== 'Wikipedia');
    if (!resolved.has(id)) {
      const file = path.join(cacheDirectory, `${id}.json`);
      let saved;
      try {
        const entry = JSON.parse(await readFile(file, 'utf8'));
        if (entry.id === id && typeof entry.rdf === 'string' && Number.isFinite(entry.checkedAt)) {
          wikipediaFromGeoNames(entry.rdf, id);
          saved = entry;
        }
      } catch (error) {
        if (error.code && error.code !== 'ENOENT') throw error;
      }
      let entry = saved;
      if (saved && (cacheMode === 'reuse' || (cacheMode === 'ttl' && now() >= saved.checkedAt && now() - saved.checkedAt < 30 * 86400000))) {
        stats.cached++;
      } else {
        try {
          networkSignal.throwIfAborted();
          const source = `https://sws.geonames.org/${id}/about.rdf`;
          const response = await fetchImpl(source, {
            headers: { Accept: 'application/rdf+xml', 'User-Agent': 'Lenz-Briefe/1.0 (https://lenz-briefe.de)' },
            signal: AbortSignal.any([networkSignal, AbortSignal.timeout(requestTimeout)]),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const rdf = await response.text();
          wikipediaFromGeoNames(rdf, id);
          entry = { id, source, rdf, checkedAt: now() };
          const temporary = `${file}.${randomUUID()}.tmp`;
          await writeFile(temporary, JSON.stringify(entry));
          await rename(temporary, file);
          stats.fetched++;
        } catch (error) {
          networkSignal.throwIfAborted();
          if (saved) stats.stale++;
          else stats.failed++;
          logger.warn(`[GeoNames] ${id}: ${error.message}; ${saved ? 'using saved data' : 'Wikipedia link omitted'}.`);
        }
      }
      resolved.set(id, entry ? {
        wikipedia: wikipediaFromGeoNames(entry.rdf, id),
        coordinates: coordinatesFromGeoNames(entry.rdf, id),
      } : null);
    }
    const record = resolved.get(id);
    const url = record?.wikipedia;
    if (url) place.links.unshift({ label: 'Wikipedia', title: 'Wikipedia · GeoNames', url, icon: 'wikipedia.svg' });
    if (record?.coordinates) {
      place.coordinates = record.coordinates;
      place.coordinateSource = `https://sws.geonames.org/${id}/about.rdf`;
    }
  }
  logger.info(`[GeoNames] ${stats.fetched} fetched, ${stats.cached} cached, ${stats.stale} stale, ${stats.failed} unavailable.`);
  return stats;
}
