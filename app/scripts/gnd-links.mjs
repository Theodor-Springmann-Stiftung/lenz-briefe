import { readFileSync } from 'node:fs';

const icons = JSON.parse(readFileSync(new URL('../../assets/reference-icons/sources.json', import.meta.url), 'utf8'));
const names = {
  'BNF': 'BnF', 'LC': 'Library of Congress', 'WIKIDATA': 'Wikidata',
  'dewiki': 'Wikipedia', 'enwiki': 'Wikipedia (EN)', 'WIKISOURCE': 'Wikisource',
  'DE-611': 'Kalliope', 'RAAS': 'RAA · Stammbücher', 'RAAE': 'RAA · Einträge',
  'ARCHIV-D': 'Archivportal-D', 'OSTDEBIB': 'Ostdeutsche Biographie',
};
const hostNames = {
  'dbpedia.org': 'DBpedia', 'isni.org': 'ISNI', 'sws.geonames.org': 'GeoNames',
  'www.filmportal.de': 'filmportal.de', 'kalliope-verbund.info': 'Kalliope',
};

function webUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch { return null; }
}

/** Only link resources explicitly supplied by the authority record. */
export function referenceLinks(record, kind = 'people') {
  const links = [{
    label: 'GND', title: 'Gemeinsame Normdatei · lobid',
    url: `https://lobid.org/gnd/${record.gndIdentifier}`,
    icon: icons['gnd.network']?.file || 'database.svg',
  }];
  const seen = new Set();
  for (const field of ['wikipedia', 'sameAs', 'homepage']) {
    for (const entry of Array.isArray(record[field]) ? record[field] : []) {
      const url = webUrl(entry?.id);
      if (!url || url.hostname === 'd-nb.info') continue;
      // Preserve anchors: ADB and NDB share a page but are separate articles.
      const key = url.href.replace(/^http:/, 'https:').replace(/\/$/, '');
      if (seen.has(key)) continue;
      seen.add(key);
      const collection = entry.collection || {};
      const wiki = url.hostname.match(/^([a-z-]+)\.wikipedia\.org$/);
      const label = wiki ? (wiki[1] === 'de' ? 'Wikipedia' : `Wikipedia (${wiki[1].toUpperCase()})`)
        : names[collection.abbr] || collection.abbr || hostNames[url.hostname] || collection.name || url.hostname.replace(/^www\./, '');
      links.push({
        label, title: collection.name || label, url: url.href,
        icon: (wiki ? icons['de.wikipedia.org'] : icons[url.hostname])?.file || 'database.svg',
      });
    }
  }
  const providers = kind === 'places'
    ? ['Wikipedia', 'GND', 'GeoNames']
    : ['GND', 'Wikipedia', 'NDB', 'VIAF', 'Portraitindex', 'Kalliope'];
  return providers.flatMap((label) => {
    // Prefer German Wikipedia; offer one other language only if German is absent.
    const link = links.find((link) => link.label === label) ||
      (label === 'Wikipedia' ? links.find((link) => link.label.startsWith('Wikipedia (')) : null);
    return link ? [{ ...link, label }] : [];
  });
}
