import proj4 from 'proj4';

// Wikimedia Europe_laea_location_map.svg, EPSG:3035. Coordinates are x/easting,
// y/northing; WGS84 input is longitude, latitude (not the EPSG axis order).
export const MAP = { width: 1401, height: 1198, xmin: 2555000, ymin: 1350000, xmax: 7405000, ymax: 5500000 };
const LAEA = '+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +units=m +no_defs';

export function projectPlace(longitude, latitude) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return null;
  const [easting, northing] = proj4('EPSG:4326', LAEA, [longitude, latitude]);
  return { x: (easting - MAP.xmin) / (MAP.xmax - MAP.xmin) * MAP.width,
    y: (MAP.ymax - northing) / (MAP.ymax - MAP.ymin) * MAP.height };
}

export function gndCoordinates(record) {
  if (!record?.type?.includes('PlaceOrGeographicName')) return null;
  for (const geometry of record.hasGeometry || []) {
    for (const wkt of geometry.asWKT || []) {
      const match = /^Point\s*\(\s*([+-]?[\d.]+)\s+([+-]?[\d.]+)\s*\)$/i.exec(wkt);
      if (!match) continue;
      const longitude = Number(match[1]), latitude = Number(match[2]);
      if (projectPlace(longitude, latitude)) return { longitude, latitude };
    }
  }
  return null;
}

// Registration of the replacement Inkscape SVG's geographic layer within its
// new root viewBox. Preserve its small translated margin when zooming closely.
export function mapImagePoint(point) {
  return { ...point,
    x: (point.x * 0.26458333 + 0.94893) / 372.02402 * MAP.width,
    y: (point.y * 0.26458333 + 0.984003) / 318.04477 * MAP.height };
}

export function fitLetterMap(points, width = 260, height = 200, padding = 48) {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const ymin = Math.min(...ys), ymax = Math.max(...ys);
  const samePlace = xmin === xmax && ymin === ymax;
  const maxZoom = samePlace ? 0.38 : 0.65;
  // Keep regional context unless a short route needs more room for its arrow.
  const readableRouteZoom = samePlace ? 0 : Math.min(3, 24 / Math.hypot(xmax - xmin, ymax - ymin));
  const scale = Math.max(width / MAP.width, height / MAP.height, readableRouteZoom,
    Math.min((width - padding * 2) / Math.max(xmax - xmin, 1),
      (height - padding * 2) / Math.max(ymax - ymin, 1), maxZoom));
  // Pan toward available geography when centering would expose an SVG edge.
  const x = width / 2 - (xmin + xmax) / 2 * scale;
  const y = height / 2 - (ymin + ymax) / 2 * scale;
  return { scale, x: Math.max(width - MAP.width * scale, Math.min(0, x)),
    y: Math.max(height - MAP.height * scale, Math.min(0, y)) };
}

export function alternateLetterMapFit(points, fit, width = 260, height = 200) {
  if (fit.scale <= 0.65) return null;
  const scale = Math.max(width / MAP.width, height / MAP.height, 0.65);
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const x = width / 2 - (Math.min(...xs) + Math.max(...xs)) / 2 * scale;
  const y = height / 2 - (Math.min(...ys) + Math.max(...ys)) / 2 * scale;
  return { scale, x: Math.max(width - MAP.width * scale, Math.min(0, x)),
    y: Math.max(height - MAP.height * scale, Math.min(0, y)) };
}

export function combinedRouteDot(from, to, samePlace = false) {
  // Source radius includes half its 1.25-unit stroke; target radius is 2.5.
  if (!samePlace && Math.hypot(to.x - from.x, to.y - from.y) > 5.625) return null;
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

export function mergeLetterMapDots(dots) {
  // Compare the original visible dots, including the outer half of a stroke.
  // Connected chains form one group; enlarging a merged marker must not pull
  // in places whose original dots did not touch.
  const radius = dot => dot.source && dot.target ? 4 : dot.source ? 3.125 : 2.5;
  const remaining = new Set(dots);
  const groups = [];
  for (const dot of dots) {
    if (!remaining.delete(dot)) continue;
    const members = [dot];
    for (let i = 0; i < members.length; i++) {
      for (const candidate of remaining) {
        if (Math.hypot(candidate.x - members[i].x, candidate.y - members[i].y) <= radius(candidate) + radius(members[i])) {
          remaining.delete(candidate);
          members.push(candidate);
        }
      }
    }
    groups.push({
      x: members.reduce((sum, member) => sum + member.x, 0) / members.length,
      y: members.reduce((sum, member) => sum + member.y, 0) / members.length,
      ids: members.map(member => member.id),
      source: members.some(member => member.source),
      target: members.some(member => member.target),
      merged: members.length > 1,
    });
  }
  return groups;
}

export function curvedRoute(from, to) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const sourceGap = Math.min(4, distance * 0.3);
  const targetGap = Math.min(4.5, distance * 0.3);
  const bend = Math.min(20, Math.max(0, distance - sourceGap - targetGap) * 0.14);
  const control = { x: (from.x + to.x) / 2 - Math.sin(angle) * bend,
    y: (from.y + to.y) / 2 + Math.cos(angle) * bend };
  const towardControl = (point, gap) => {
    const length = Math.hypot(control.x - point.x, control.y - point.y);
    return length ? { x: point.x + (control.x - point.x) / length * gap,
      y: point.y + (control.y - point.y) / length * gap } : { ...point };
  };
  // Quadratic endpoint tangents pass through the control point. Trim along
  // those tangents so both gaps and the arrowhead align with the dot centres.
  return { start: towardControl(from, sourceGap), end: towardControl(to, targetGap), control };
}

export function routeLabelPositions(from, to, same = false) {
  // Keep the complete text (including its halo) outside the route's vertical
  // extent. This also clears the arrowhead on vertical and very short routes.
  const position = (point, above) => ({ x: point.x,
    y: point.y + (above ? -18 : 25), anchor: point.x <= 130 ? 'start' : 'end' });
  if (same) return [{ x: from.x, y: from.y + 25, anchor: 'middle' }];
  const fromAbove = from.y <= to.y;
  return [position(from, fromAbove), position(to, !fromAbove)];
}

export function buildCorrespondenceMap(catalog, saved, information = {}) {
  const places = Object.entries(catalog.places).flatMap(([id, definition]) => {
    const fallback = saved[id];
    const matching = fallback?.name === definition.name && fallback?.reference === definition.ref;
    const coordinates = information[id]?.coordinates || (matching ? fallback : null);
    if (!coordinates) return [];
    const point = projectPlace(coordinates.longitude, coordinates.latitude);
    return point ? [{ id, name: definition.name, ...point, approximate: matching && fallback.precision === 'region' }] : [];
  });
  const known = new Set(places.map(({ id }) => id));
  const routes = [], omitted = [];
  for (const letter of catalog.letters) {
    // A draft is not evidence of a sent letter; alternative locations must not
    // be turned into multiple invented journeys or silently reduced to one.
    if (letter.isDraft) { omitted.push({ letter: letter.letter, reason: 'draft' }); continue; }
    const endpoints = ['sent', 'received'].map((type) => [...new Set(letter.events
      .filter((event) => event.type === type).flatMap((event) => event.locations.map((place) => place.ref)))]);
    if (endpoints.some((ids) => ids.length !== 1)) {
      omitted.push({ letter: letter.letter, reason: 'missing or ambiguous endpoint' }); continue;
    }
    const [from, to] = endpoints.map(([id]) => id);
    if (!known.has(from) || !known.has(to)) {
      omitted.push({ letter: letter.letter, reason: 'unlocated endpoint' }); continue;
    }
    routes.push({ letter: letter.letter, from, to });
  }
  return { places, routes, omitted };
}
