import { MAP } from './correspondence-map.mjs';

export function placeMapViews(place, width = 120, height = 150) {
  const cover = Math.max(width / MAP.width, height / MAP.height);
  return [0.2, 0.4, 0.8].map(zoom => {
    const scale = Math.max(cover, zoom);
    return { scale,
      x: Math.max(width - MAP.width * scale, Math.min(0, width / 2 - place.x * scale)),
      y: Math.max(height - MAP.height * scale, Math.min(0, height / 2 - place.y * scale)),
    };
  });
}
