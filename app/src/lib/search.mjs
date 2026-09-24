// Keep spelling and accents; only case, punctuation and whitespace are ignored.
export function normalizeSearch(text) {
  return text.normalize('NFC').toLowerCase().replace(/[\p{P}\p{White_Space}]/gu, '');
}

export function prepareSearch(blocks) {
  return blocks.map(block => ({...block, normalized: normalizeSearch(block.text)}));
}

export function searchBlocks(blocks, query) {
  const needle = normalizeSearch(query);
  return needle ? blocks.filter(block => block.normalized.includes(needle)) : [];
}

const graphemes = new Intl.Segmenter('de', {granularity: 'grapheme'});

// Offsets refer to the original preview, including spaces and punctuation.
export function matchRanges(text, query) {
  const needle = normalizeSearch(query);
  if (!needle) return [];
  const normalized = normalizeSearch(text);
  const starts = [], ends = [];
  for (const {segment, index} of graphemes.segment(text)) {
    const length = normalizeSearch(segment).length;
    for (let i = 0; i < length; i++) {
      starts.push(index);
      ends.push(index + segment.length);
    }
  }
  const ranges = [];
  for (let from = 0; from < normalized.length;) {
    const index = normalized.indexOf(needle, from);
    if (index < 0) break;
    const start = starts[index], end = ends[index + needle.length - 1];
    const previous = ranges.at(-1);
    if (previous && start < previous.end) previous.end = end;
    else ranges.push({start, end});
    from = index + 1;
  }
  return ranges;
}

export function matchPages(block, query) {
  const match = matchRanges(block.text, query)[0];
  if (!match) return [];
  const pages = block.pages || [];
  return [...new Set(pages.filter(([start], index) =>
    start < match.end && (pages[index + 1]?.[0] ?? Infinity) > match.start,
  ).map(([, page]) => page))];
}

export function searchPreview(text, query, context = 90) {
  const ranges = matchRanges(text, query);
  if (!ranges.length) return [];
  const first = ranges[0];
  let start = Math.max(0, first.start - context);
  let end = Math.min(text.length, first.end + context);
  // Trim partial words at the outside edges, without trimming the match itself.
  while (start > 0 && start < first.start && !/\s/u.test(text[start - 1])) start++;
  while (end < text.length && end > first.end && !/\s/u.test(text[end])) end--;
  const parts = [];
  if (start) parts.push({text: '… ', match: false});
  let cursor = start;
  for (const range of ranges) {
    if (range.start >= end) break;
    if (range.end <= start) continue;
    if (range.start > cursor) parts.push({text: text.slice(cursor, range.start), match: false});
    const stop = Math.min(range.end, end);
    parts.push({text: text.slice(Math.max(cursor, range.start), stop), match: true});
    cursor = stop;
  }
  if (cursor < end) parts.push({text: text.slice(cursor, end), match: false});
  if (end < text.length) parts.push({text: ' …', match: false});
  return parts;
}
