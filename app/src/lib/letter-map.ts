import { catalog, gndInformation } from './edition';
import coordinates from '../data/place-coordinates.json';
import { buildCorrespondenceMap, mapImagePoint, letterMapZoomLevels } from './correspondence-map.mjs';

// This module runs during Astro's static build, never in the browser.
const network = buildCorrespondenceMap(catalog, coordinates.places, gndInformation.places);
const places = new Map(network.places.map(place => [place.id, mapImagePoint(place)]));
export const letterMapLocations = new Map(catalog.letters.map(letter => {
  const endpoints = ['sent', 'received'].map(type => [...new Set(letter.events
    .filter(event => event.type === type).flatMap(event => event.locations.map(place => place.ref)))]);
  const resolved = endpoints.map(ids => ids.map(id => places.get(id)));
  const available = resolved.every(side => side.length > 0 && side.every(Boolean));
  return [letter.letter, available ? resolved : null] as const;
}));
export const letterMapLevels = letterMapZoomLevels([...letterMapLocations.values()]
  .filter(points => points !== null).map(points => points.flat()));
