import { parseFragment } from 'parse5';

// Shared by letter sidenotes and Markdown asset references.
/** @param {string} source @param {string} position @param {number[]} rotations @returns {string} */
export function renderSidenotePosition(source, position, rotations = []) {
  const key = position.trim().toLowerCase().replace(/\s+/g, '-');
  const labels = {
    top: 'oben',
    right: 'rechts',
    bottom: 'unten',
    left: 'links',
    'top-right': 'oben rechts',
    'top-left': 'oben links',
    'bottom-right': 'unten rechts',
    'bottom-left': 'unten links',
  };
  if (!labels[key]) throw new Error(`Unknown sidenote position: ${position}`);
  const angles = [...new Set(rotations)].filter((angle) => Number.isFinite(angle) && angle > 0 && angle <= 359);
  const pageLayer = angles.length ? 'page-clipped' : 'page';
  const layers = [...source.matchAll(/<g\b[^>]*inkscape:label="([^"]+)"[^>]*>/g)].map((match) =>
    match[1].toLowerCase(),
  );
  if (!layers.includes(pageLayer) || !layers.includes(key)) {
    throw new Error(`Missing SVG layer for sidenote position: ${position}`);
  }
  // Keep the supplied drawing as the single source for all eight positions.
  // Its IDs are not referenced internally and must not repeat across icons.
  const svg = source
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<sodipodi:namedview\b[\s\S]*?<\/sodipodi:namedview>/g, '')
    .replace(/\s+id="[^"]*"/g, '')
    .replace(/<g\b([^>]*)>/g, (group, attributes) => {
      const layer = attributes.match(/inkscape:label="([^"]+)"/)?.[1].toLowerCase();
      return layer
        ? `<g${attributes} data-layer="${layer}" data-active="${layer === pageLayer || layer === key}">`
        : group;
    });
  const angle = angles.length === 1 ? angles[0] : null;
  const turn = angle !== null && angle > 180 ? angle - 360 : angle;
  const rotationTooltip = angles.map((value) => value === 270 ? '90° gegen den Uhrzeigersinn gedreht' : value === 180 ? '180° gedreht' : `${value}° im Uhrzeigersinn gedreht`).join(', ');
  const description = `Randnotiz: ${labels[key]}${angles.length ? `. Schreibrichtung im Original: ${angles.map((value) => value === 270 ? '90° gegen den Uhrzeigersinn' : value === 180 ? '180°' : `${value}° im Uhrzeigersinn`).join(', ')}.` : ''}`;
  const rotationAttributes = angles.length
    ? ` data-tooltip="${rotationTooltip}" tabindex="0" data-rotatable="true"${angle !== null ? ` data-rotation="${angle}" style="--sidenote-turn: ${turn}deg"` : ''} data-turn-direction="${turn !== null && turn < 0 ? 'counterclockwise' : 'clockwise'}"`
    : '';
  return `<span class="sidenote-position" role="img" aria-label="${description}" title="${description}" data-position="${key}"${rotationAttributes}>${svg}</span>`;
}

/** @param {string} html @param {string} source @returns {string} */
export function expandSidenotePositions(html, source) {
  return html.replace(
    /<!--[\s\S]*?-->|<lkb-sidenote-position\s+position=["']([^"']+)["']\s*>\s*<\/lkb-sidenote-position\s*>/g,
    (match, position) => (position ? renderSidenotePosition(source, position) : match),
  );
}

/** Read distinct rotations from actual transform elements, not annotation text.
 * @param {string} html @returns {number[]}
 */
export function sidenoteRotations(html) {
  const angles = new Set();
  function visit(node) {
    const attributes = Object.fromEntries((node.attrs || []).map(({ name, value }) => [name, value]));
    if ((attributes.class || '').split(/\s+/).includes('tr') && attributes['data-rot'] !== undefined) {
      const value = Number(attributes['data-rot']);
      if (Number.isFinite(value) && value > 0 && value <= 359) angles.add(value);
    }
    for (const child of node.childNodes || []) visit(child);
  }
  visit(parseFragment(html));
  return [...angles];
}
