// Shared by letter sidenotes and Markdown asset references.
/** @param {string} source @param {string} position @returns {string} */
export function renderSidenotePosition(source, position) {
const key = position.trim().toLowerCase().replace(/\s+/g, '-');
const labels = {
  top: 'oben', right: 'rechts', bottom: 'unten', left: 'links',
  'top-right': 'oben rechts', 'top-left': 'oben links',
  'bottom-right': 'unten rechts', 'bottom-left': 'unten links',
};
if (!labels[key]) throw new Error(`Unknown sidenote position: ${position}`);
const layers = [...source.matchAll(/<g\b[^>]*inkscape:label="([^"]+)"[^>]*>/g)]
  .map(match => match[1].toLowerCase());
if (!layers.includes('page') || !layers.includes(key)) {
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
    return layer ? `<g${attributes} data-layer="${layer}" data-active="${layer === 'page' || layer === key}">` : group;
  });
return `<span class="sidenote-position" role="img" aria-label="Randnotiz: ${labels[key]}" title="Randnotiz: ${labels[key]}" data-position="${key}">${svg}</span>`;
}

/** @param {string} html @param {string} source @returns {string} */
export function expandSidenotePositions(html, source) {
  return html.replace(/<!--[\s\S]*?-->|<lkb-sidenote-position\s+position=["']([^"']+)["']\s*>\s*<\/lkb-sidenote-position\s*>/g,
    (match, position) => position ? renderSidenotePosition(source, position) : match);
}
