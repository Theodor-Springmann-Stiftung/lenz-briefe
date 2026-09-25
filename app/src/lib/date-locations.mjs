/** Split a date heading into text and references to its sender locations. */
export function dateLocationParts(text, locations) {
  return text.split(/(;\s*)/).flatMap(segment => {
    const comma = segment.indexOf(',');
    if (comma < 0 || !locations.length) return [{text: segment}];
    const prefix = segment.slice(0, comma);
    if (locations.length === 1) {
      return [{text: prefix, placeId: locations[0].ref}, {text: segment.slice(comma)}];
    }
    // Multiple senders or alternative places: resolve each name, never guess an ID.
    const names = locations.flatMap(location => {
      const label = location.label || '';
      return [label, label.replace(/\s*\[[^\]]*\]/g, '')]
        .filter(Boolean).map(name => ({name, placeId: location.ref}));
    }).sort((a, b) => b.name.length - a.name.length);
    const parts = [];
    let start = 0;
    for (let index = 0; index < prefix.length;) {
      const match = names.find(({name}) => prefix.startsWith(name, index)
        && (index === 0 || !/[\p{L}\p{N}]/u.test(prefix[index - 1]))
        && !/[\p{L}\p{N}]/u.test(prefix[index + name.length] || ''));
      if (!match) { index++; continue; }
      if (index > start) parts.push({text: prefix.slice(start, index)});
      parts.push({text: match.name, placeId: match.placeId});
      index += match.name.length;
      start = index;
    }
    parts.push({text: segment.slice(start)});
    return parts;
  });
}
